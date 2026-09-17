-- CreateTable
CREATE TABLE "HouseStyleRule" (
    "id" TEXT NOT NULL,
    "canonical" TEXT NOT NULL,
    "variants" TEXT NOT NULL DEFAULT '',
    "forceLowercase" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseStyleRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseStyleRule_enabled_sortOrder_idx" ON "HouseStyleRule"("enabled", "sortOrder");

-- Seed the built-in rule book (idempotent). Built-in rows can be edited or
-- disabled but not deleted; admins add their own on top.
INSERT INTO "HouseStyleRule" ("id","canonical","variants","forceLowercase","message","builtin","enabled","sortOrder","createdAt","updatedAt") VALUES
  ('hs_ecommerce','e-commerce','ecommerce, e commerce',true,'House style: always lowercase, hyphenated — “e-commerce”.',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('hs_email','email','e-mail, e mail',false,'House style: one word, no hyphen — “email”.',true,true,2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('hs_online','online','on-line, on line',false,'House style: one word — “online”.',true,true,3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('hs_website','website','web site, web-site',false,'House style: one word — “website”.',true,true,4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('hs_websites','websites','web sites, web-sites',false,'House style: one word — “websites”.',true,true,5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('hs_nonprofit','nonprofit','non-profit, non profit',false,'House style: one word, no hyphen — “nonprofit”.',true,true,6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('hs_usps','USPS','usps',false,'Proper name — all caps: “USPS”.',true,true,7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('hs_fedex','FedEx','fedex, fed ex, fed-ex',false,'Proper name — “FedEx”.',true,true,8,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('hs_paypal','PayPal','paypal, pay pal, pay-pal',false,'Proper name — “PayPal”.',true,true,9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
