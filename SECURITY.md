# **Security Policy**

Thank you for contributing to WarMatrix\! We take the security of our tactical simulation engine, 3D interface, and AI layer seriously. This document outlines our supported versions, vulnerability reporting process, and baseline security practices.

## **Supported Versions**

We only support the latest version


## **Reporting a Vulnerability**

**Please do not open a public GitHub issue for security vulnerabilities.** Public exposure puts deployments of the command console at risk before a patch can be deployed.

### **1\. How to Report**

If you discover a security flaw (e.g., AI prompt injection risks, simulation engine buffer overflows, or exposed API keys), please report it via one of the following methods:

* **GitHub Private Vulnerability Reporting:** Navigate to the **Security** tab of this repository, click **Vulnerabilities**, and select **Report a vulnerability**. (Recommended)  
* **Email:** Send a detailed report to security@warmatrix.io (optionally encrypted using our PGP key found in SECURITY\_KEY.asc).

### **2\. What to Include**

To help us triage the issue quickly, please provide:

* A clear description of the vulnerability and its potential impact (e.g., Frontend XSS, Backend Remote Code Execution).  
* Step-by-step instructions or a Proof of Concept (PoC) script to reproduce the issue.  
* The version(s) of WarMatrix affected.

### **3\. Our Response Timeline**

* **Acknowledgement:** Within 48 hours.  
* **Triage & Status Update:** Within 7 days.  
* **Fix & Advisory Release:** We aim to resolve and publicly disclose the issue within 30 to 60 days, coordinating with the reporter.
