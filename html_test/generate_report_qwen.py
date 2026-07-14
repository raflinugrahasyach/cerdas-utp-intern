import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os

# Pastikan membaca file CSV Coder yang sudah dijahit akurasinya
CSV_FILE = "extraction_coder.csv" 
OUTPUT_IMAGE = "report_qwen_only.png"

def main():
    print(f"Mencari file {CSV_FILE}...")
    
    if not os.path.exists(CSV_FILE):
        print(f"❌ File {CSV_FILE} tidak ditemukan!")
        return
        
    df = pd.read_csv(CSV_FILE)
    
    # FILTER SPESIFIK: Hanya ambil data Qwen2.5-Coder 14B
    df_qwen = df[df['Model'] == 'qwen2.5-coder:14b'].copy()
    
    if df_qwen.empty:
        print("❌ Data qwen2.5-coder:14b tidak ditemukan di dalam CSV!")
        return

    # Pastikan kolom berupa numerik
    for col in ['Precision', 'Recall', 'F1_Score']:
        df_qwen[col] = pd.to_numeric(df_qwen[col], errors='coerce').fillna(0)

    # Format ulang data (Melt) agar bisa diplot sebagai diagram batang berdampingan
    df_melted = df_qwen.melt(
        id_vars=['Users'],
        value_vars=['Precision', 'Recall', 'F1_Score'],
        var_name='Metric',
        value_name='Percentage'
    )

    # Mengatur tema visual (Clean & Industrial Minimalism)
    plt.style.use('default')
    sns.set_theme(style="whitegrid", rc={
        "axes.facecolor": "#F8F9FA", 
        "grid.color": "#E9ECEF",
        "font.family": "sans-serif"
    })

    custom_palette = {"Precision": "#4A90E2", "Recall": "#F5A623", "F1_Score": "#1A2530"}

    # Membuat figure tunggal
    plt.figure(figsize=(7, 4.5))

    # Membuat bar chart
    ax = sns.barplot(
        data=df_melted,
        x='Users',
        y='Percentage',
        hue='Metric',
        palette=custom_palette,
        edgecolor="white",
        linewidth=1.5
    )

    # Mempercantik label dan sumbu
    ax.set_xlabel('Concurrent Users', fontsize=12, fontweight='bold', labelpad=10)
    ax.set_ylabel('Score (%)', fontsize=12, fontweight='bold', labelpad=10)
    ax.set_ylim(0, 105)
    
    # Garis bawah solid
    ax.axhline(0, color='black', linewidth=1.5)

    # Memindahkan legend agar tidak menutupi grafik
    plt.legend(
        title="", 
        bbox_to_anchor=(0.5, 1.15), 
        loc="upper center", 
        ncol=3, 
        frameon=False,
        fontsize=11
    )

    # MENGHAPUS JUDUL GRAFIK (Sesuai instruksi Supervisor untuk paper IEEE)
    plt.title("")

    # Merapikan *layout* agar tidak ada yang terpotong saat disimpan
    plt.tight_layout()

    # Menyimpan hasil akhir
    plt.savefig(OUTPUT_IMAGE, dpi=300, transparent=False, bbox_inches='tight')
    print(f"✅ Sukses! Grafik IEEE berhasil disimpan sebagai '{OUTPUT_IMAGE}'")

if __name__ == "__main__":
    main()