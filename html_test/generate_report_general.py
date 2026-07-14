import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os

# PASTIKAN PATH INI MENGARAH KE CSV YANG KAMU KIRIM BARUSAN
CSV_FILE = "accuracy_metrics_report.csv" 
OUTPUT_IMAGE = "report_coder_grid.png"

def main():
    print(f"Mencari file {CSV_FILE}...")
    
    if not os.path.exists(CSV_FILE):
        print("❌ File CSV tidak ditemukan!")
        return
        
    df = pd.read_csv(CSV_FILE)
    
    # 1. PERBAIKAN NAMA KOLOM DI SINI
    metric_cols = ['Precision (%)', 'Recall (%)', 'F1_Score']
    
    for col in metric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    # 2. PERBAIKAN VALUE VARS DI SINI
    df_melted = df.melt(
        id_vars=['Model', 'Users'],
        value_vars=metric_cols,
        var_name='Metric',
        value_name='Percentage'
    )

    plt.style.use('default')
    sns.set_theme(style="whitegrid", rc={
        "axes.facecolor": "#F8F9FA", 
        "grid.color": "#E9ECEF",
        "font.family": "sans-serif"
    })

    # Mengganti nama label di legend agar lebih rapi
    df_melted['Metric'] = df_melted['Metric'].replace({
        'Precision (%)': 'Precision',
        'Recall (%)': 'Recall'
    })

    custom_palette = {"Precision": "#4A90E2", "Recall": "#F5A623", "F1_Score": "#1A2530"}

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

    g.fig.subplots_adjust(top=0.88)
    g.fig.suptitle(
        'Coder Models Extraction Accuracy Under Concurrency Load', 
        fontsize=22, 
        fontweight='bold'
    )

    for ax in g.axes.flat:
        model_name = ax.get_title().split('=')[-1].strip()
        
        ax.set_title(model_name, fontsize=14, fontweight='bold', pad=10)
        ax.set_xlabel('Concurrent Users', fontsize=12)
        ax.set_ylabel('Score (%)', fontsize=12)
        ax.set_ylim(0, 105)
        ax.axhline(0, color='black', linewidth=1.5)

    sns.move_legend(
        g, "upper center", 
        bbox_to_anchor=(0.5, 0.96), 
        ncol=3, 
        title=None, 
        frameon=True,
        fontsize=12
    )

    plt.savefig(OUTPUT_IMAGE, dpi=300, bbox_inches='tight')
    print(f"✅ Masterpiece tersimpan: {OUTPUT_IMAGE}")

if __name__ == "__main__":
    main()