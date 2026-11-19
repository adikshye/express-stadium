import os
import matplotlib.pyplot as plt

os.makedirs("docs", exist_ok=True)

# 1. DORA Metrics Dashboard (LZ-10)
metrics = ['Deploy Frequency\n(per week)', 'Lead Time\n(days)', 'Change Failure\nRate (%)', 'Time to Restore\n(hours)']
values = [2, 4.5, 15, 2.5]
targets = [5, 2, 5, 1]
colors = ['#3498db', '#e67e22', '#e74c3c', '#2ecc71']

fig, axs = plt.subplots(2, 2, figsize=(12, 8))
fig.suptitle('DORA Metrics Dashboard - "Express" Project (LZ-10)', fontsize=16, fontweight='bold')
for i, ax in enumerate(axs.flat):
    ax.bar(['Current', 'Target'], [values[i], targets[i]], color=[colors[i], '#bdc3c7'])
    ax.set_title(metrics[i])
    ax.set_ylim(0, max(values[i], targets[i]) * 1.3)
    ax.text(0, values[i] + (max(values[i], targets[i]) * 0.05), str(values[i]), ha='center', fontweight='bold')
    ax.text(1, targets[i] + (max(values[i], targets[i]) * 0.05), str(targets[i]), ha='center', fontweight='bold')
plt.tight_layout()
plt.savefig('docs/dora_dashboard.png', bbox_inches='tight')
plt.close()

# 2. Executive Project Dashboard (LZ-14)
fig = plt.figure(figsize=(12, 5))
fig.suptitle('"Express" Project Executive Dashboard (LZ-14)', fontsize=16, fontweight='bold')

ax1 = plt.subplot(1, 3, 1)
ax1.pie([29, 13], labels=['Done (70%)', 'Remaining (30%)'], colors=['#2ecc71', '#e74c3c'], autopct='%1.1f%%', startangle=90)
ax1.set_title('Sprint Progress (29/42 tasks)')

ax2 = plt.subplot(1, 3, 2)
ax2.bar(['Planned TCO', 'Actual Spend'], [112000, 78000], color=['#3498db', '#9b59b6'])
ax2.set_title('Annual Budget (KZT)')
ax2.set_ylim(0, 130000)

ax3 = plt.subplot(1, 3, 3)
ax3.axis('off')
ax3.set_title('Flow & DORA Metrics')
ax3.text(0.05, 0.80, 'Cycle Time (avg): 2.1 days', fontsize=11)
ax3.text(0.05, 0.65, 'Throughput: 7 tasks / sprint', fontsize=11)
ax3.text(0.05, 0.50, 'Deploy Freq: 2 / week', fontsize=11)
ax3.text(0.05, 0.35, 'Change Failure Rate: 15%', fontsize=11)
ax3.text(0.05, 0.15, 'Status: YELLOW (Scope reduced)', fontsize=11, color='#d35400', fontweight='bold')

plt.tight_layout()
plt.savefig('docs/project_dashboard.png', bbox_inches='tight')
plt.close()
print("Dashboards generated successfully.")
