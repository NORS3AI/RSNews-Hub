-- The order contact moves onto the campaign (archived per order — the paper
-- trail of who placed each order). The vendor-level "latest order contact"
-- fields are dropped; the vendor keeps only its admin-curated public contact.
ALTER TABLE "AdCampaign" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT;

ALTER TABLE "Vendor" DROP COLUMN "orderContactEmail",
DROP COLUMN "orderContactName";
