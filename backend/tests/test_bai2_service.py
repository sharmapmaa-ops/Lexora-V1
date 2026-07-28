from decimal import Decimal

import pytest

from app.services.processing.bai2_service import Bai2ParseError, bai2_to_dict, parse_bai2

SAMPLE = """\
01,BANKID,LEXORA,260101,0800,1,,,2/
02,LEXORA,BANKID,1,260101,0800,USD,2/
03,1234567890,USD,010,150000,,,040,150000,,/
16,409,50000,,REF001,,Payment received from ABC Corp/
16,451,20000,,REF002,,Wire transfer to XYZ Ltd/
88,continued narrative text here/
49,1650000,3/
98,1650000,1,4/
99,1650000,1,5/
"""


def test_parses_file_header():
    result = parse_bai2(SAMPLE)
    assert result.sender_id == "BANKID"
    assert result.receiver_id == "LEXORA"
    assert result.file_creation_date == "260101"


def test_parses_one_group_and_account():
    result = parse_bai2(SAMPLE)
    assert len(result.groups) == 1
    group = result.groups[0]
    assert len(group.accounts) == 1
    account = group.accounts[0]
    assert account.account_number == "1234567890"
    assert account.currency == "USD"


def test_summary_items_converted_from_minor_units():
    result = parse_bai2(SAMPLE)
    account = result.groups[0].accounts[0]
    assert account.summary_items[0]["type_code"] == "010"
    assert account.summary_items[0]["amount"] == "1500"  # 150000 minor units -> 1500 major units


def test_transaction_amounts_and_continuation_merge():
    result = parse_bai2(SAMPLE)
    txns = result.groups[0].accounts[0].transactions
    assert len(txns) == 2
    assert txns[0].amount == Decimal("500")
    assert txns[0].text == "Payment received from ABC Corp"
    # The 88 continuation record's text got appended onto the last
    # transaction seen before it (transaction #2).
    assert "continued narrative text here" in txns[1].text


def test_missing_file_header_raises():
    with pytest.raises(Bai2ParseError):
        parse_bai2("02,LEXORA,BANKID,1,260101,0800/\n99,0,0,0/\n")


def test_to_dict_is_json_serializable():
    import json

    result = parse_bai2(SAMPLE)
    payload = bai2_to_dict(result)
    # Round-trips through json.dumps without error - the real
    # requirement, since this is stored in a JSONB column.
    json.dumps(payload)
    assert payload["groups"][0]["accounts"][0]["transaction_count"] == 2
