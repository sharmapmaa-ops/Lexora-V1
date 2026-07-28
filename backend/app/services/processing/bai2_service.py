"""
BAI2 bank statement parser.

BAI2 is a fixed-structure, comma-delimited, slash-terminated text format
for bank statement data (as opposed to lease abstraction / translation /
OCR, which genuinely need an LLM). This parser is deterministic and
needs no external API call, which makes it the right first pipeline to
port into the new architecture: every layer of the pattern (upload ->
job -> processing -> billing -> stored result) can be built and
verified for real, right now, without needing OpenRouter/OpenAI
credentials this environment doesn't have.

Record types implemented (the ones that appear in essentially every
real BAI2 file):
  01 - File Header
  02 - Group Header
  03 - Account Identifier / Summary
  16 - Transaction Detail
  49 - Account Trailer
  98 - Group Trailer
  99 - File Trailer
  88 - Continuation of the previous record (concatenated onto it)

Reference: BAI2 Cash Management Balance Reporting specification.
"""
from __future__ import annotations

import dataclasses
from decimal import Decimal, InvalidOperation


class Bai2ParseError(Exception):
    pass


@dataclasses.dataclass
class Bai2Transaction:
    type_code: str
    amount: Decimal
    funds_type: str
    bank_reference: str
    customer_reference: str
    text: str


@dataclasses.dataclass
class Bai2Account:
    account_number: str
    currency: str
    summary_items: list[dict]
    transactions: list[Bai2Transaction] = dataclasses.field(default_factory=list)


@dataclasses.dataclass
class Bai2Group:
    receiver_id: str
    originator_id: str
    as_of_date: str
    accounts: list[Bai2Account] = dataclasses.field(default_factory=list)


@dataclasses.dataclass
class Bai2File:
    sender_id: str
    receiver_id: str
    file_creation_date: str
    file_creation_time: str
    groups: list[Bai2Group] = dataclasses.field(default_factory=list)


def _split_fields(line: str) -> list[str]:
    """BAI2 lines are comma-delimited and end with '/' (optionally
    preceded by trailing spaces). Continuation (88) records get
    concatenated onto the previous line before this is called, so by
    the time a caller sees a logical record, it's always one line."""
    line = line.rstrip()
    if line.endswith("/"):
        line = line[:-1]
    return [f.strip() for f in line.split(",")]


def _to_decimal(raw: str) -> Decimal:
    raw = raw.strip()
    if not raw:
        return Decimal("0")
    try:
        return Decimal(raw) / 100  # BAI2 amounts are integers in minor units (cents/paise)
    except InvalidOperation as err:
        raise Bai2ParseError(f"Invalid amount: {raw!r}") from err


def _merge_continuations(raw_lines: list[str]) -> list[str]:
    """An '88' record is a continuation of the record immediately
    before it - its fields get appended (not merged field-by-field,
    just concatenated as extra trailing fields) to the prior logical
    line before parsing continues."""
    merged: list[str] = []
    for line in raw_lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("88,") and merged:
            # Drop the "88," prefix and splice the remaining fields
            # onto the previous line, before its trailing '/'.
            continuation = stripped[3:]
            prev = merged[-1].rstrip()
            if prev.endswith("/"):
                prev = prev[:-1]
            merged[-1] = f"{prev},{continuation}"
        else:
            merged.append(stripped)
    return merged


def parse_bai2(raw_text: str) -> Bai2File:
    lines = _merge_continuations(raw_text.splitlines())

    bai2_file: Bai2File | None = None
    current_group: Bai2Group | None = None
    current_account: Bai2Account | None = None

    for line in lines:
        if not line:
            continue
        record_type = line[:2]
        fields = _split_fields(line)

        if record_type == "01":
            # 01,sender,receiver,creation_date,creation_time,file_id,...
            if len(fields) < 5:
                raise Bai2ParseError(f"Malformed file header: {line!r}")
            bai2_file = Bai2File(
                sender_id=fields[1], receiver_id=fields[2],
                file_creation_date=fields[3], file_creation_time=fields[4],
            )

        elif record_type == "02":
            if bai2_file is None:
                raise Bai2ParseError("Group header (02) appeared before file header (01).")
            # 02,receiver,originator,bai_version,as_of_date,as_of_time,...
            current_group = Bai2Group(
                receiver_id=fields[1], originator_id=fields[2],
                as_of_date=fields[4] if len(fields) > 4 else "",
            )
            bai2_file.groups.append(current_group)
            current_account = None

        elif record_type == "03":
            if current_group is None:
                raise Bai2ParseError("Account identifier (03) appeared before a group header (02).")
            # 03,account_number,currency,[type_code,amount,item_count,funds_type]*
            account_number = fields[1]
            currency = fields[2] if len(fields) > 2 and fields[2] else "USD"
            summary_items = []
            # Remaining fields come in groups of 4: type, amount, item_count, funds_type.
            rest = fields[3:]
            for i in range(0, len(rest) - 3, 4):
                chunk = rest[i:i + 4]
                if len(chunk) < 2 or not chunk[0]:
                    continue
                summary_items.append({
                    "type_code": chunk[0],
                    "amount": str(_to_decimal(chunk[1])),
                    "item_count": chunk[2] if len(chunk) > 2 else "",
                    "funds_type": chunk[3] if len(chunk) > 3 else "",
                })
            current_account = Bai2Account(
                account_number=account_number, currency=currency, summary_items=summary_items,
            )
            current_group.accounts.append(current_account)

        elif record_type == "16":
            if current_account is None:
                raise Bai2ParseError("Transaction detail (16) appeared before an account identifier (03).")
            # 16,type_code,amount,funds_type,bank_ref,customer_ref,text...
            current_account.transactions.append(Bai2Transaction(
                type_code=fields[1],
                amount=_to_decimal(fields[2]) if len(fields) > 2 else Decimal("0"),
                funds_type=fields[3] if len(fields) > 3 else "",
                bank_reference=fields[4] if len(fields) > 4 else "",
                customer_reference=fields[5] if len(fields) > 5 else "",
                text=",".join(fields[6:]) if len(fields) > 6 else "",
            ))

        elif record_type == "49":
            current_account = None
        elif record_type == "98":
            current_group = None
            current_account = None
        elif record_type == "99":
            pass  # file trailer - nothing further to extract
        # Unrecognized record types are skipped rather than raising -
        # a BAI2 file from an unfamiliar bank may include vendor
        # extensions we don't need to understand to extract balances
        # and transactions.

    if bai2_file is None:
        raise Bai2ParseError("No file header (01) record found - this doesn't look like a BAI2 file.")
    return bai2_file


def bai2_to_dict(bai2_file: Bai2File) -> dict:
    """JSON-serializable shape for storing in ProcessingJob.result_metadata
    and for the frontend to render."""
    return {
        "sender_id": bai2_file.sender_id,
        "receiver_id": bai2_file.receiver_id,
        "file_creation_date": bai2_file.file_creation_date,
        "groups": [
            {
                "originator_id": g.originator_id,
                "as_of_date": g.as_of_date,
                "accounts": [
                    {
                        "account_number": a.account_number,
                        "currency": a.currency,
                        "summary_items": a.summary_items,
                        "transaction_count": len(a.transactions),
                        "transactions": [
                            {
                                "type_code": t.type_code,
                                "amount": str(t.amount),
                                "funds_type": t.funds_type,
                                "bank_reference": t.bank_reference,
                                "customer_reference": t.customer_reference,
                                "text": t.text,
                            }
                            for t in a.transactions
                        ],
                    }
                    for a in g.accounts
                ],
            }
            for g in bai2_file.groups
        ],
    }
