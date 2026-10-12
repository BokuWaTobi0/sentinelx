import os


def main(payload: dict):
    # This step receives the validated output of the preceding step.
    result = {
        "jobId": payload["jobId"],
        "incidentId": payload["incidentId"],
        "kind": payload["kind"],
        "engine": "WINDMILL",
        "realWorldChanges": False,
    }
    run_id = os.environ.get("WM_ROOT_FLOW_JOB_ID") or os.environ.get("WM_JOB_ID")
    if run_id:
        result["windmillRunId"] = run_id
    if payload["kind"] == "INVESTIGATE":
        count = payload["failureCount"]
        ips = len(set(payload["sourceIps"]))
        result.update({
            "failureCount": count,
            "sourceIpCount": ips,
            "summary": f"Snapshot review: {count} failed logins for {payload['actor']} across {ips} source IPs in {payload.get('windowSeconds', 60)} seconds.",
            "recommendation": "Review the exact event timeline and verify the actor's activity before requesting containment. This is a rule-based snapshot review, not external threat intelligence.",
        })
        if payload.get("evidenceTruncated"):
            result["recommendation"] += " The event evidence snapshot was truncated."
    else:
        result.update({
            "responseId": payload["responseId"],
            "actor": payload["actor"],
            "action": "CONTAIN_ACTOR",
            "mode": "SIMULATION",
            "message": "Windmill completed simulated containment. No real account, network or device was changed.",
        })
    return result
