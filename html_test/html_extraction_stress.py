import requests
import time
import json
import concurrent.futures
import pandas as pd
import os
import subprocess
import re

MODELS = [
    "llama3.1:8b",
    "gemma2:9b",
    "mistral:7b",
    "qwen2.5:14b",        # Versi Base/Instruct, bukan versi Coder
    "phi3:14b",
    "qwen2.5:32b"
]

NUM_USERS_LIST = [1, 4, 8]
CTX_SIZE = 16384

API_URL = "http://127.0.0.1:11434/api/generate"
CSV_FILE = "html_test/extraction_general_benchmark.csv"
JSON_OUT_DIR = "html_test/model_general_json_outputs"
HTML_DIR = "html_test/html_pages"
GT_FILE = "html_test/master_ground_truth.json"

os.makedirs(JSON_OUT_DIR, exist_ok=True)
os.makedirs(HTML_DIR, exist_ok=True)

TARGET_KEYS = ["product_name", "price"] 

def clean_system():
    print("[System] Restarting Ollama & Clearing RAM...")
    subprocess.run(["sudo", "systemctl", "restart", "ollama"], check=False, capture_output=True)
    subprocess.run(["sudo", "sync"], check=False)
    subprocess.run(["sudo", "sh", "-c", "echo 3 > /proc/sys/vm/drop_caches"], check=False)
    time.sleep(10)

def monitor_hardware(stop_event, hw_data_list, meta):
    with jtop() as jetson:
        while not stop_event.is_set():
            if jetson.ok():
                ram_gb = psutil.virtual_memory().used / (1024**3)
                power_w = jetson.power['tot']['power'] / 1000.0 if 'tot' in jetson.power else 0.0
                hw_data_list.append({
                    **meta,
                    'timestamp': time.time(),
                    'gpu_util_pct': float(jetson.stats.get('GPU', 0.0)),
                    'ram_used_gb': round(ram_gb, 2),
                    'power_watt': round(power_w, 2)
                })
            time.sleep(0.5)

def extract_json_from_response(text):
    # coba ambil blok code markdown (json opsional)
    match = re.search(r'```(?:json)?(.*?)```', text, re.DOTALL)

    if match:
        text = match.group(1).strip()
    else:
        text = text.strip()

    try:
        return True, json.loads(text)
    except json.JSONDecodeError:
        return False, text

def normalize_string(s):
    if not isinstance(s, str): return str(s)
    return s.strip().lower().replace('\u00a3', '£')

def calculate_metrics(extracted_list, gt_list):
    if not isinstance(extracted_list, list):
        return 0, len(gt_list), 0 # Format rusak, FN semua
        
    tp, fp = 0, 0
    gt_copy = list(gt_list)
    
    for item in extracted_list:
        if not isinstance(item, dict):
            fp += 1
            continue
            
        e_name, e_price = normalize_string(item.get("product_name", "")), normalize_string(item.get("price", ""))
        
        match_found = False
        for i, gt_item in enumerate(gt_copy):
            if e_name == normalize_string(gt_item.get("product_name", "")) and e_price == normalize_string(gt_item.get("price", "")):
                tp += 1
                del gt_copy[i]
                match_found = True
                break
                
        if not match_found: fp += 1
            
    fn = len(gt_copy)
    return tp, fn, fp

def simulate_user(html_filename, html_content, model_name):
    prompt_text = f"""You are an expert data extraction algorithm. Extract the product name and price from the following HTML. 
CRITICAL RULES:
1. Return ONLY a valid JSON array of objects with keys 'product_name' and 'price'.
2. Extract ALL products found in the HTML. Do NOT use placeholder text like "// More products".
3. Output pure JSON without markdown or explanations.

HTML:
{html_content[:50000]} 
"""
    
    payload = {
        "model": model_name,
        "prompt": prompt_text,
        "stream": False,
        "options": {
            "temperature": 0.0,
            "num_ctx": CTX_SIZE,
            "num_predict": 2500
        }
    }

    try:
        start_time = time.time()
        response = requests.post(API_URL, json=payload, timeout=600)
        total_time = time.time() - start_time

        if response.status_code != 200:
            return {
                "file": html_filename,
                "status": "Failed",
                "tps": 0,
                "valid_json": False,
                "data": response.text
            }

        data = response.json()

        if "error" in data:
            return {
                "file": html_filename,
                "status": "Failed",
                "tps": 0,
                "valid_json": False,
                "data": data["error"]
            }

        eval_duration = data.get("eval_duration", 0)
        eval_count = data.get("eval_count", 0)

        # asumsi eval_duration dalam nanoseconds (ollama default)
        tps = (eval_count / eval_duration) * 1e9 if eval_duration > 0 else 0

        raw_text = data.get("response", "")

        is_valid, parsed_data = extract_json_from_response(raw_text)

        return {
            "file": html_filename,
            "status": "Success",
            "tps": tps,
            "valid_json": is_valid,
            "data": parsed_data,
            "time_sec": round(total_time, 2)
        }

    except Exception as e:
        return {
            "file": html_filename,
            "status": "Failed",
            "tps": 0,
            "valid_json": False,
            "data": str(e)
        }


def save_csv(data_dict):
    df = pd.DataFrame([data_dict])
    df.to_csv(CSV_FILE, mode='a', header=not os.path.exists(CSV_FILE), index=False)


def main():
    print("Starting GENERAL HTML Extraction Benchmark\n")

    if not os.path.exists(GT_FILE):
        print(f"ERROR: Kunci Jawaban '{GT_FILE}' tidak ditemukan!")
        return

    with open(GT_FILE, 'r', encoding='utf-8') as f:
        ground_truth = json.load(f)

    html_files = [f for f in os.listdir(HTML_DIR) if f.endswith('.html')]
    if not html_files:
        print(f"Directory '{HTML_DIR}' is empty. Please add HTML files.")
        return

    if os.path.exists(CSV_FILE):
        history = pd.read_csv(CSV_FILE)
    else:
        history = pd.DataFrame(columns=["Model", "Users"])

    for model in MODELS:
        print(f"\n--- MODEL: {model} ---")

        model_json_path = os.path.join(JSON_OUT_DIR, f"{model.replace(':', '_')}.json")
        model_results = []

        if os.path.exists(model_json_path):
            try:
                with open(model_json_path, "r") as f:
                    model_results = json.load(f)
            except:
                model_results = []

        for users in NUM_USERS_LIST:

            if not history.empty and not history[
                (history["Model"] == model) & (history["Users"] == users)
            ].empty:
                print(f"   -> {users} User(s): SKIPPED (Data exists)")
                continue

            print(f"   -> {users} User(s): Testing...", end=" ", flush=True)

            clean_system()

            tasks = []
            for h_file in html_files:
                with open(os.path.join(HTML_DIR, h_file), 'r', encoding='utf-8') as f:
                    tasks.append((h_file, f.read()))

            with concurrent.futures.ThreadPoolExecutor(max_workers=users) as executor:
                futures = [
                    executor.submit(simulate_user, t[0], t[1], model)
                    for t in tasks
                ]
                results = [f.result() for f in concurrent.futures.as_completed(futures)]

            success_res = [r for r in results if r["status"] == "Success"]
            failed_res = [r for r in results if r["status"] == "Failed"]

            total_tp, total_fn, total_fp = 0, 0, 0
            
            for r in results:
                h_file = r["file"]
                gt_data = ground_truth.get(h_file, [])
                
                if r["status"] == "Success" and r["valid_json"]:
                    tp, fn, fp = calculate_metrics(r["data"], gt_data)
                    total_tp += tp
                    total_fn += fn
                    total_fp += fp
                else:
                    # Kalau gagal/error, hitung semua isi halaman web sebagai yang terlewat
                    total_fn += len(gt_data)
            
            precision = (total_tp / (total_tp + total_fp)) * 100 if (total_tp + total_fp) > 0 else 0
            recall = (total_tp / (total_tp + total_fn)) * 100 if (total_tp + total_fn) > 0 else 0
            f1_score = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
            
            valid_json_count = sum(1 for r in success_res if r["valid_json"])
            valid_rate = (valid_json_count / len(html_files)) * 100

            valid_json_count = sum(1 for r in success_res if r["valid_json"])

            if failed_res and len(success_res) == 0:
                print("FAILED (OOM or Server Error)")
                save_csv({
                    "Model": model, "Users": users, "Status": "Failed",
                    "Avg_TPS": 0.0, "Valid_JSON_Rate": "0%", "Avg_Time_Sec": 0.0,
                    "Precision": 0.0, "Recall": 0.0, "F1_Score": 0.0 # Tambahan kolom baru
                })
                break
            else:
                avg_tps = sum(r["tps"] for r in success_res) / len(success_res) if success_res else 0
                avg_time = sum(r["time_sec"] for r in success_res) / len(success_res) if success_res else 0

                # Print ke terminal jadi lebih kaya data
                print(f"SUCCESS | TPS: {avg_tps:.2f} | Valid: {valid_rate:.0f}% | F1-Score: {f1_score:.1f}% (Prec: {precision:.1f}%, Rec: {recall:.1f}%)")

                save_csv({
                    "Model": model, "Users": users, "Status": "Success",
                    "Avg_TPS": round(avg_tps, 2), "Valid_JSON_Rate": f"{valid_rate:.0f}%", "Avg_Time_Sec": round(avg_time, 2),
                    "Precision": round(precision, 2), "Recall": round(recall, 2), "F1_Score": round(f1_score, 2) # Tambahan kolom baru
                })

                model_results.append({
                    "users_concurrency": users,
                    "extractions": results
                })

                with open(model_json_path, "w") as f:
                    json.dump(model_results, f, indent=4)


if __name__ == "__main__":
    main()