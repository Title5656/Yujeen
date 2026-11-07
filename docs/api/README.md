# HTTP API — M0

`GET /api/health` → HTTP 200, `Content-Type: application/json`

```json
{ "status": "ok" }
```

API และ web ตรวจ payload ด้วย `HealthResponseSchema` จาก `@portfolio/contracts` ไม่มี secret, portfolio data หรือ database readiness ใน health

Unknown route → HTTP 404:

```json
{ "error": { "code": "NOT_FOUND", "message": "ไม่พบเส้นทางที่ร้องขอ" } }
```

Unexpected exception → HTTP 500:

```json
{ "error": { "code": "INTERNAL_ERROR", "message": "เกิดข้อผิดพลาดภายในระบบ" } }
```

Error body ตรวจด้วย `ApiErrorSchema`; ไม่ส่ง exception text หรือ stack trace HTTP API อื่นใน PROJECT_SPEC.md เป็นแผน ยังไม่ได้เปิดใช้งานใน M0
