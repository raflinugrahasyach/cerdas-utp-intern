import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os

# Nama file CSV yang dihasilkan oleh script stress test tadi
CSV_FILE = "accuracy_metrics_report.csv"
OUTPUT_IMAGE = "report_coder.png"

def main():
    print(f"Mencari file {CSV_FILE}...")
    
    if not os.path.exists(CSV_FILE):
        print("❌ File CSV tidak ditemukan! Pastikan benchmark sudah selesai berjalan.")
        return
        
    # Membaca data dari CSV
    df = pd.read_csv(CSV_FILE)
    
    # Memastikan kolom metrik terbaca sebagai angka numerik
    for col in ['Precision', 'Recall', 'F1_Score']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    # Memformat ulang data (Melt) agar mudah diplot oleh Seaborn
    df_melted = df.melt(
        id_vars=['Model', 'Users'],
        value_vars=['Precision', 'Recall', 'F1_Score'],
        var_name='Metric',
        value_name='Percentage'
    )

    # Mengatur tema visual (Industrial Minimalism)
    plt.style.use('default')
    sns.set_theme(style="whitegrid", rc={
        "axes.facecolor": "#F8F9FA", 
        "grid.color": "#E9ECEF",
        "font.family": "sans-serif"
    })

    # Palet warna
    custom_palette = {"Precision": "#4A90E2", "Recall": "#F5A623", "F1_Score": "#1A2530"}

    # Membuat Multi-Plot Grid (1 Model = 1 Kotak)
    # col_wrap=4 artinya maksimal 4 kotak per baris
    g = sns.catplot(
        data=df_melted,
        x='Users',
        y='Percentage',
        hue='Metric',
        col='Model',
        col_wrap=4,       
        kind='bar',
        height=4,         
        aspect=1.2,       
        palette=custom_palette,
        edgecolor="white",
        linewidth=1
    )

    # Merapikan Judul Utama
    g.fig.subplots_adjust(top=0.88)
    g.fig.suptitle(
        'General Models Extraction Accuracy Under Concurrency Load', 
        fontsize=22, 
        fontweight='bold'
    )

    # Merapikan setiap kotak kecil (Subplot)
    for ax in g.axes.flat:
        # Mengambil nama model (menghapus teks bawaan "Model = ...")
        model_name = ax.get_title().split('=')[-1].strip()
        
        ax.set_title(model_name, fontsize=14, fontweight='bold', pad=10)
        ax.set_xlabel('Concurrent Users', fontsize=12)
        ax.set_ylabel('Score (%)', fontsize=12)
        ax.set_ylim(0, 105)
        
        # Garis batas bawah tegas
        ax.axhline(0, color='black', linewidth=1.5)

    # Mengatur posisi legend di atas tengah
    sns.move_legend(
        g, "upper center", 
        bbox_to_anchor=(0.5, 0.96), 
        ncol=3, 
        title=None, 
        frameon=True,
        fontsize=12
    )

    # Menyimpan gambar
    plt.savefig(OUTPUT_IMAGE, dpi=300, bbox_inches='tight')
    print(f"✅ Masterpiece tersimpan: {OUTPUT_IMAGE}")

if __name__ == "__main__":
    main()