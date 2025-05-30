# **Security Policy**

## **Supported Versions**
The following versions of **Disaster Alert Aggregator PH** are supported with security updates:

| Version | Supported |
| ------- | --------- |
| 1.0     | ✅ Yes |

## **Security Measures**
Since the app scrapes data from **official government sources (PAGASA & PHIVOLCS)** and stores it in **Supabase**, the following security measures are crucial:
- **Legal Compliance:** Adhere to PAGASA & PHIVOLCS' terms of service for ethical data usage.
- **Rate Limiting:** Prevent excessive requests that may trigger bans or IP blacklisting.
- **Data Validation & Sanitization:** Prevent injection attacks and filter scraped data for accuracy.
- **HTTPS Enforcement:** Secure all API requests and database interactions.
- **Error Handling & Logging:** Maintain robust logs for system monitoring and debugging.
- **Supabase Security:** Apply database security best practices, including **row-level security (RLS)**.
- **GitHub Actions Hardening:** Secure workflows and secrets in **GitHub Actions**.

## **Reporting a Vulnerability**
If you discover a security issue in **Disaster Alert Aggregator PH**, please follow these steps:
1. **Submit a Report:** Email `kcpersonalacc@gmail.com`.
2. **Provide Details:** Describe the vulnerability, risk level, and steps to reproduce.
3. **Response Time:** Expect an initial reply within **48 hours**.
4. **Resolution Plan:** If verified, appropriate security patches will be deployed.

## **Data Storage Policy**
Since **Supabase** stores alerts, the following measures are in place:
- **Public Access Control:** Anonymous users can read alerts, but data modifications are restricted.
- **Database Encryption:** Sensitive Supabase configurations are securely stored.
- **API Rate Limits:** Control access frequency to prevent abuse.
