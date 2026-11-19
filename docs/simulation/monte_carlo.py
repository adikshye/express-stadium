import os
import numpy as np
import matplotlib.pyplot as plt


def run_simulation():
    rng = np.random.default_rng(42)
    history = np.array([4, 6, 0, 7, 5, 2, 6, 9, 4, 5, 0, 6, 7, 4, 5, 1, 6, 5, 9, 3, 4, 6, 5, 8, 2, 5])
    BACKLOG, RUNS = 42, 10_000
    weeks = np.empty(RUNS, dtype=int)
    for i in range(RUNS):
        done, w = 0, 0
        while done < BACKLOG:
            done += rng.choice(history)
            w += 1
        weeks[i] = w

    for p in (50, 70, 85, 95):
        print(f"P{p}: {np.percentile(weeks, p):.0f} апта")

    os.makedirs("docs/simulation", exist_ok=True)
    plt.figure(figsize=(10, 5))
    plt.hist(weeks, bins=range(weeks.min(), weeks.max() + 2), align='left', color='steelblue', edgecolor='black')
    plt.axvline(np.percentile(weeks, 50), color='red', linestyle='dashed', linewidth=2, label='P50 (9 апта)')
    plt.axvline(np.percentile(weeks, 85), color='green', linestyle='dashed', linewidth=2, label='P85 (11 апта)')
    plt.title('Мерзімдерді ықтималдықпен болжау (10 000 прогон) - "Express" жобасы')
    plt.xlabel('Аяқтауға қажетті апта саны')
    plt.ylabel('Прогондар саны')
    plt.legend()
    plt.grid(axis='y', alpha=0.5)
    plt.savefig('docs/simulation/monte_carlo_histogram.png', bbox_inches='tight')
    plt.close()


if __name__ == "__main__":
    run_simulation()
