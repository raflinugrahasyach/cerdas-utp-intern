import pandas as pd
import os

CODER_FILE = "extraction_coder.csv"
ACCURACY_FILE = "accuracy_metrics_report.csv"
TARGET_COLS = ["Model", "Users", "Status", "Avg_TPS", "Valid_JSON_Rate", "Avg_Time_Sec", "Precision", "Recall", "F1_Score"]

def main():
    print("Mulai menjahit data CSV...\n")

    if not os.path.exists(CODER_FILE) or not os.path.exists(ACCURACY_FILE):
        print(f"❌ Error: Pastikan file {CODER_FILE} dan {ACCURACY_FILE} ada!")
        return

    df_coder = pd.read_csv(CODER_FILE)
    df_acc = pd.read_csv(ACCURACY_FILE)

    # Menyamakan nama kolom di file akurasi (jaga-jaga kalau formatnya beda)
    df_acc.rename(columns={'Precision (%)': 'Precision', 'Recall (%)': 'Recall'}, inplace=True)

    # ANTI-ERROR: Hapus kolom metrik di file Coder jika sudah ada dari run sebelumnya
    for col in ['Precision', 'Recall', 'F1_Score']:
        if col in df_coder.columns:
            df_coder.drop(columns=[col], inplace=True)

    df_acc_clean = df_acc[['Model', 'Users', 'Precision', 'Recall', 'F1_Score']].copy()

    # Gabungkan (Merge)
    df_merged = pd.merge(df_coder, df_acc_clean, on=['Model', 'Users'], how='left')

    # Isi nilai 0 untuk model yang gagal/tidak ada datanya
    df_merged['Precision'] = df_merged['Precision'].fillna(0)
    df_merged['Recall'] = df_merged['Recall'].fillna(0)
    df_merged['F1_Score'] = df_merged['F1_Score'].fillna(0)

    # Urutkan sesuai TARGET_COLS (Sama persis dengan General)
    df_merged = df_merged[TARGET_COLS]

    # Simpan kembali
    df_merged.to_csv(CODER_FILE, index=False)
    print(f"✅ Sukses! File '{CODER_FILE}' sekarang SAMA PERSIS dengan General.")

if __name__ == "__main__":
    main()