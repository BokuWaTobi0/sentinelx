from uuid import UUID


def main(payload: dict):
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    for key in ("jobId", "incidentId"):
        UUID(payload[key])
    kind = payload.get("kind")
    if kind not in ("INVESTIGATE", "CONTAIN_SIMULATED"):
        raise ValueError("unsupported workflow kind")
    actor = payload.get("actor")
    if not isinstance(actor, str) or not actor.strip() or len(actor) > 500:
        raise ValueError("invalid evidence actor")
    if kind == "CONTAIN_SIMULATED":
        UUID(payload["responseId"])
        UUID(payload["requestedBy"])
        UUID(payload["approvedBy"])
        if payload.get("approved") is not True or payload["requestedBy"] == payload["approvedBy"]:
            raise ValueError("independent approval required")
    else:
        count = payload.get("failureCount")
        if type(count) is not int or count < 0:
            raise ValueError("invalid failure count")
        ips = payload.get("sourceIps")
        if not isinstance(ips, list) or any(not isinstance(ip, str) for ip in ips):
            raise ValueError("invalid source IP snapshot")
    return payload
