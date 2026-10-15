import numpy as np
import matplotlib.pyplot as plt

def run_simulation():
    # 1. Бастапқы деректер (Эталонға сай)
    rng = np.random.default_rng(42)   # Зерно генератора зафиксировано (нәтиже қайталанады)
    history = np.array([4, 6, 0, 7, 5, 2, 6, 9, 4, 5, 0, 6, 7, 4, 5, 1, 6, 5, 9, 3, 4, 6, 5, 8, 2, 5])
    BACKLOG, RUNS = 42, 10_000

    # 2. Симуляция (bootstrap)
    weeks = np.empty(RUNS, dtype=int)
    for i in range(RUNS):
        done, w = 0, 0
        while done < BACKLOG:
            done += rng.choice(history)   # тарихтан кездейсоқ аптаны алу
            w += 1
        weeks[i] = w

    # 3. Перцентильдерді консольге шығару
    print("Монте-Карло ықтималдық болжамы (42 тапсырма үшін):")
    for p in (50, 70, 85, 95):
        print(f'P{p}: {np.percentile(weeks, p):.0f} апта')

    # 4. График сызу (Гистограмма)
    plt.figure(figsize=(10, 5))
    plt.hist(weeks, bins=range(weeks.min(), weeks.max()+2), align='left', color='steelblue', edgecolor='black')
    
    # P50 және P85 сызықтарын қосу
    plt.axvline(np.percentile(weeks, 50), color='red', linestyle='dashed', linewidth=2, label='P50 (9 апта / 14 желтоқсан)')
    plt.axvline(np.percentile(weeks, 85), color='green', linestyle='dashed', linewidth=2, label='P85 (11 апта / 28 желтоқсан)')
    
    plt.title('Мерзімдерді ықтималдықпен болжау (10 000 прогон) - "Express" жобасы')
    plt.xlabel('Аяқтауға қажетті апта саны')
    plt.ylabel('Прогондар саны')
    plt.legend()
    plt.grid(axis='y', alpha=0.5)
    
    # Графикті файл ретінде сақтау
    plt.savefig('monte_carlo_histogram.png', bbox_inches='tight')
    print("\nГрафик 'monte_carlo_histogram.png' деген атаумен сақталды.")
    
    # Графикті экранға шығару
    plt.show()

if __name__ == "__main__":
    run_simulation()
