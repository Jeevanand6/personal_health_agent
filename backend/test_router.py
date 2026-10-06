import sys
import uuid
from app.services.query_router import query_router, QueryRouteMode
from app.models.chat_session import ChatMessage

test_queries = [
    ("What medicines did my doctor prescribe?", None, None, [QueryRouteMode.PERSONAL_HEALTH]),
    ("What is diabetes?", None, None, [QueryRouteMode.GENERAL]),
    ("Explain Python in simple words.", None, None, [QueryRouteMode.GENERAL]),
    ("What is my latest Hb?", None, None, [QueryRouteMode.PERSONAL_HEALTH]),
    ("What does my Hb result mean?", None, None, [QueryRouteMode.MIXED_HEALTH]),
    ("Explain my prescription.", None, None, [QueryRouteMode.MIXED_HEALTH, QueryRouteMode.DOCUMENT_SPECIFIC]),
    ("What is today's weather?", None, None, [QueryRouteMode.CURRENT_WEB]),
    ("Who is Elon Musk?", None, None, [QueryRouteMode.GENERAL]),
    ("Give me a workout plan", None, None, [QueryRouteMode.GENERAL]),
    ("Write an email", None, None, [QueryRouteMode.GENERAL]),
    ("What are the benefits of meditation?", None, None, [QueryRouteMode.GENERAL]),
]

all_passed = True
for q, doc_id, hist, expected in test_queries:
    res = query_router.route(q, doc_id, hist)
    ok = res.mode in expected
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] '{q}' -> {res.mode} (expected {expected})")
    if not ok:
        all_passed = False

# Test follow-up
hb_msg = ChatMessage(role="assistant", content="Your latest recorded Hb is 9.2 g/dL.")
res_fu = query_router.route("What does that mean?", None, [hb_msg])
fu_ok = res_fu.mode == QueryRouteMode.MIXED_HEALTH
status_fu = "PASS" if fu_ok else "FAIL"
print(f"[{status_fu}] Follow-up 'What does that mean?' -> {res_fu.mode} (target={res_fu.target_entity})")

# Test general follow-up
py_msg = ChatMessage(role="assistant", content="Python is an interpreted programming language.")
res_py_fu = query_router.route("Can you give me an example code?", None, [py_msg])
py_ok = res_py_fu.mode == QueryRouteMode.GENERAL
status_py = "PASS" if py_ok else "FAIL"
print(f"[{status_py}] Follow-up 'Can you give me an example code?' -> {res_py_fu.mode}")

if all_passed and fu_ok and py_ok:
    print("\n>>> ALL ROUTER UNIT TESTS PASSED SUCCESSFULLY! <<<")
else:
    print("\n>>> SOME ROUTER UNIT TESTS FAILED! <<<")
    sys.exit(1)
