import { Router } from "express";

const router = Router();

const BULLETPROOF_CLAUSES = [
  {
    id: "net-14",
    category: "Payment",
    title: "Net-14 with Late Fee",
    clause:
      "Payment is due within 14 days of invoice date. Unpaid balances accrue a service charge of 1.5% per month (18% annually) on the outstanding amount.",
    replaces: "Net-30, Net-60, or Net-90 payment terms",
    severity: "High",
  },
  {
    id: "revision-cap",
    category: "Scope",
    title: "Revision Cap with Hourly Overflow",
    clause:
      "This agreement includes up to three (3) rounds of revisions within the defined scope. Additional revision rounds are billed at the Contractor's standard hourly rate of $[RATE]/hour, invoiced upon completion.",
    replaces: "Unlimited revisions until client satisfaction",
    severity: "High",
  },
  {
    id: "conditional-ip",
    category: "IP Ownership",
    title: "Conditional IP Transfer on Full Payment",
    clause:
      "All intellectual property rights in the deliverables transfer to Client upon receipt of full and final payment. Until such payment is received, Contractor retains all intellectual property rights and grants Client a limited, non-exclusive license for internal review purposes only.",
    replaces: "Immediate work-for-hire assignment upon delivery",
    severity: "High",
  },
  {
    id: "kill-fee",
    category: "Termination",
    title: "Kill Fee Protection",
    clause:
      "If Client terminates this agreement without cause after work has commenced, Client shall pay Contractor a kill fee equal to 50% of the remaining contract value, due within seven (7) days of the termination notice.",
    replaces: "At-will termination with no compensation",
    severity: "High",
  },
  {
    id: "liability-cap",
    category: "Liability",
    title: "Mutual Liability Cap",
    clause:
      "Each party's total aggregate liability to the other for any claim arising under this agreement shall not exceed the total fees paid or payable to Contractor in the three (3) months immediately preceding the event giving rise to the claim.",
    replaces: "Unlimited liability exposure",
    severity: "Medium",
  },
  {
    id: "change-order",
    category: "Scope",
    title: "Written Change Order Requirement",
    clause:
      "Any modification to the agreed scope of work requires a written Change Order signed by both parties before additional work commences. Verbal approvals, emails, or Slack messages do not constitute authorization for out-of-scope work.",
    replaces: "Informal scope expansion through verbal requests",
    severity: "Medium",
  },
  {
    id: "deposit",
    category: "Payment",
    title: "50% Non-Refundable Deposit",
    clause:
      "Work on this project commences upon receipt of a non-refundable deposit equal to 50% of the total contract value. The remaining balance is due upon delivery of final deliverables, prior to transfer of files.",
    replaces: "Payment only upon final completion and approval",
    severity: "Medium",
  },
  {
    id: "tool-carveout",
    category: "IP Ownership",
    title: "Pre-existing IP & Tools Carveout",
    clause:
      "Contractor retains all ownership of and rights to pre-existing intellectual property, proprietary tools, frameworks, methodologies, and reusable components used in delivering the services. Client receives no rights to Contractor's pre-existing IP beyond what is necessary to use the agreed deliverables.",
    replaces: "Blanket work-for-hire clauses that capture all tools and methods",
    severity: "Medium",
  },
];

router.get("/clauses", (req, res) => {
  const { search, category } = req.query as Record<string, string>;
  let results = BULLETPROOF_CLAUSES;

  if (category && category !== "All") {
    results = results.filter(
      (c) => c.category.toLowerCase() === category.toLowerCase()
    );
  }

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.clause.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.replaces.toLowerCase().includes(q)
    );
  }

  return res.json({ clauses: results });
});

export default router;
