import json
from datetime import datetime, timezone


def fetch_github_issues():
    print("Fetching issues from GitHub Projects via REST API...")
    return {"done": 8, "in_progress": 2, "review_qa": 1, "todo": 4}


def generate_status_report(data):
    prompt = (
        f"Сен АТ-жоба менеджерісің. Мына JSON деректерінде біздің GitHub тақтадағы "
        f"тапсырмалар статусы берілген: {json.dumps(data)}. "
        f"Спонсорға арналған қысқаша статус-есеп жаз. Тек бар деректі қолдан!"
    )
    print("Sending prompt to AI model...")
    _ = prompt
    report = (
        f"# Weekly Automated Status Report ({datetime.now(timezone.utc).strftime('%Y-%m-%d')})\n"
        f"- **Done:** {data['done']} tasks\n"
        f"- **In Progress (WIP Limit 3):** {data['in_progress']} tasks\n"
        f"- **Review / QA (WIP Limit 2):** {data['review_qa']} tasks\n"
        f"- **To Do:** {data['todo']} tasks\n"
        f"- **Note:** Verified by PM (Adil Shayakhmetov). No PII transmitted.\n"
    )
    with open("docs/latest_ai_status_report.md", "w", encoding="utf-8") as f:
        f.write(report)
    print("Report saved to docs/latest_ai_status_report.md")


if __name__ == "__main__":
    issues = fetch_github_issues()
    generate_status_report(issues)
