"""Seed sample data into the active CSV for development."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.models.task import TaskBucket, TaskCreate, TaskPriority
from app.services.task_service import create_task, ACTIVE_CSV, COMPLETED_CSV, _ensure_csv, _read_csv

_ensure_csv(ACTIVE_CSV)
_ensure_csv(COMPLETED_CSV)

# Only seed if the active file is empty
if len(_read_csv(ACTIVE_CSV)) > 0:
    print("Active tasks already exist — skipping seed.")
    sys.exit(0)

seeds = [
    TaskCreate(title="Review Q1 infrastructure costs", description="Pull billing data and flag anomalies", priority=TaskPriority.HIGH, project="FinOps", tags="billing,review", bucket=TaskBucket.TODAY),
    TaskCreate(title="Patch prod web servers", description="Apply March security patches", priority=TaskPriority.CRITICAL, project="Infrastructure", tags="security,patching", bucket=TaskBucket.TODAY),
    TaskCreate(title="Onboard new team member laptop", description="Provision laptop, accounts, and VPN", priority=TaskPriority.MEDIUM, project="Onboarding", tags="onboarding", bucket=TaskBucket.THIS_WEEK),
    TaskCreate(title="Update runbook for DB failover", description="Add new replica steps", priority=TaskPriority.MEDIUM, project="Documentation", tags="docs,database", bucket=TaskBucket.THIS_WEEK),
    TaskCreate(title="Investigate slow API response times", description="Latency spikes on /api/reports", priority=TaskPriority.HIGH, project="Performance", tags="api,perf", bucket=TaskBucket.IN_PROGRESS),
    TaskCreate(title="Waiting on vendor license key", description="Blocked until vendor responds", priority=TaskPriority.MEDIUM, project="Licensing", tags="vendor,blocked", bucket=TaskBucket.BLOCKED),
    TaskCreate(title="Evaluate new monitoring tool", description="Compare Datadog vs Grafana Cloud", priority=TaskPriority.LOW, project="Tooling", tags="monitoring,evaluation", bucket=TaskBucket.BACKLOG),
    TaskCreate(title="Automate weekly status report", description="Script to pull metrics and generate report", priority=TaskPriority.LOW, project="Automation", tags="reporting,scripting", bucket=TaskBucket.BACKLOG),
    TaskCreate(title="Set up staging environment", description="Mirror prod config for testing", priority=TaskPriority.HIGH, project="Infrastructure", tags="staging,infra", bucket=TaskBucket.INCOMING),
    TaskCreate(title="Renew SSL certificates", description="Expire next month, coordinate with security team", priority=TaskPriority.HIGH, project="Security", tags="ssl,certs", bucket=TaskBucket.INCOMING),
]

for s in seeds:
    t = create_task(s)
    print(f"  Created: {t.title} [{t.bucket.value}]")

print(f"\nSeeded {len(seeds)} tasks.")
