# License Migration: AGPL-3.0 → Apache 2.0 with Commons Clause

## Change Summary

**Effective Date:** October 16, 2025  
**Previous License:** GNU Affero General Public License v3.0 (AGPL-3.0)  
**New License:** Apache License 2.0 with Commons Clause

---

## Why the Change?

### Reasons for Migration:

1. **Simpler and Clearer Terms**
   - Apache 2.0 is easier to understand than AGPL
   - Commons Clause explicitly prohibits commercial exploitation
   - Clear distinction between free use and commercial use

2. **Better Commercial Protection**
   - AGPL focused on open-sourcing modifications for network services
   - Commons Clause directly prevents selling the software
   - More straightforward for users to understand restrictions

3. **More Permissive for Users**
   - Less burdensome compliance requirements
   - No requirement to open-source modifications (unless selling)
   - Easier for companies to use internally

4. **Industry Standard**
   - Apache 2.0 is widely recognized and trusted
   - Commons Clause is used by Redis, Neo4j, and other major projects
   - Better compatibility with other open-source projects

---

## What Changed?

### From AGPL-3.0:
```
✅ Use, modify, distribute freely
✅ Must share modifications if hosting publicly
✅ Strong copyleft (viral licensing)
✅ Patent protection
❌ Complex compliance requirements
❌ Unclear commercial restrictions
```

### To Apache 2.0 with Commons Clause:
```
✅ Use, modify, distribute freely
✅ Patent protection (from Apache 2.0)
✅ Simpler compliance requirements
✅ Can keep modifications private (unless commercializing)
❌ Cannot sell or offer as paid service (Commons Clause)
✅ Clearer restrictions
```

---

## How This Affects You

### If You're Using Docker Dashboard:

**✅ No Impact** - You can continue using it exactly as before:
- Personal use: Still free
- Internal business use: Still free
- Educational use: Still free
- Contributing: Still welcome

**❌ New Restriction** - You cannot:
- Sell it as a product
- Offer it as a paid hosted service
- Charge for access to your instance

### If You've Forked Docker Dashboard:

**Action Required:**
1. Update your LICENSE file to match the new license
2. Include the Commons Clause notice
3. Add the NOTICE file to your fork
4. Update any license badges/references

**Grace Period:**
Existing forks have **30 days** (until November 15, 2025) to update their licenses or contact us for alternative arrangements.

### If You're Contributing:

**✅ No Change** - Contributions are still welcome!
- Same contribution process
- Same contributor guidelines
- Your contributions are still valuable

**📝 New CLA:**
Future contributors will be asked to sign a simple Contributor License Agreement confirming they understand the license terms.

---

## Comparison Table

| Feature | AGPL-3.0 | Apache 2.0 + Commons Clause |
|---------|----------|----------------------------|
| **Free to Use** | ✅ Yes | ✅ Yes |
| **Modify Code** | ✅ Yes | ✅ Yes |
| **Share Modifications** | ✅ Yes | ✅ Yes |
| **Must Open-Source Hosted Mods** | ✅ Yes | ❌ No |
| **Patent Protection** | ✅ Yes | ✅ Yes |
| **Can Sell/Commercialize** | ⚠️ Unclear | ❌ No (Clear) |
| **Internal Company Use** | ✅ Yes | ✅ Yes |
| **Include in Paid Product** | ⚠️ Unclear | ❌ No |
| **Complexity** | High | Low |

---

## Backward Compatibility

### Old Versions (Before License Change):
- Versions ≤2.0.0 remain under AGPL-3.0
- You can continue using old versions under AGPL-3.0
- Old versions are still available in git history

### New Versions (After License Change):
- Versions >2.0.0 are under Apache 2.0 + Commons Clause
- Must comply with new license terms
- Cannot mix old AGPL code with new Apache+Commons code without proper handling

---

## Legal Notices

### For Users:
This license change is effective immediately. Continued use of new versions constitutes acceptance of the new license terms.

### For Contributors:
Past contributions were made under AGPL-3.0. By making new contributions after this change, you agree to license them under Apache 2.0 + Commons Clause.

### For Commercial Users:
If you need different licensing terms (e.g., to offer commercial hosting), contact the project maintainer to discuss commercial licensing options.

---

## Questions & Concerns

### "Can I still use it for free?"
**Yes!** Personal, educational, and internal business use is completely free.

### "Do I need to open-source my modifications now?"
**No!** Unlike AGPL, you can keep your modifications private unless you're commercializing them.

### "What if I want to offer paid hosting?"
**Contact us!** We can discuss commercial licensing arrangements.

### "Can I continue using version 2.0.0 under AGPL?"
**Yes!** Old versions remain under their original license.

### "Why not just use MIT or BSD?"
We want the software to remain free. Pure permissive licenses would allow companies to take it, rebrand it, and sell it without contributing back.

---

## Migration Timeline

- **October 16, 2025:** License change announced
- **October 16 - November 15, 2025:** Grace period for forks to update
- **November 15, 2025:** Enforcement begins
- **Ongoing:** Community support for migration questions

---

## Resources

- **New License:** [LICENSE](LICENSE) file
- **License Explanation:** [NOTICE](NOTICE) file
- **Commons Clause Info:** https://commonsclause.com/
- **Apache 2.0 Info:** https://www.apache.org/licenses/LICENSE-2.0
- **Questions:** Open an issue on GitHub

---

## Contact

For questions about this license change:

- **GitHub Issues:** https://github.com/MNDL-27/docker-dashboard/issues
- **Email:** Contact via GitHub profile
- **Commercial Licensing:** Contact project maintainer

---

**Thank you for your understanding and continued support!**

The Docker Dashboard project remains committed to being free and open source for the community while protecting against commercial exploitation.

---

**Last Updated:** October 16, 2025
