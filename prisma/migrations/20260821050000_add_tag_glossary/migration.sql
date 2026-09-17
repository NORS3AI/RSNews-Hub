-- The admin-editable Tag glossary (RS Dictionary → Tag glossary tab) the tag
-- suggester draws on. Mirrors HouseStyleRule.
CREATE TABLE "TagGlossaryTerm" (
    "id" TEXT NOT NULL,
    "canonical" TEXT NOT NULL,
    "variants" TEXT NOT NULL DEFAULT '',
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagGlossaryTerm_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TagGlossaryTerm_enabled_sortOrder_idx" ON "TagGlossaryTerm"("enabled", "sortOrder");

-- Seed the built-in industry vocabulary (idempotent). Built-in rows can be edited
-- or disabled but not deleted; admins add their own on top.
INSERT INTO "TagGlossaryTerm" ("id","canonical","variants","builtin","enabled","sortOrder","createdAt","updatedAt") VALUES
  ('tg_e_commerce','e-commerce','ecommerce, e commerce',true,true,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_returns','returns','return processing, returns management',true,true,2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_fulfillment','fulfillment','fulfilment, order fulfillment, fulfillment center',true,true,3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_shipping','shipping','shipping services',true,true,4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_packaging','packaging','packing, custom packaging',true,true,5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_mailbox_rental','mailbox rental','mailbox rentals, mailbox',true,true,6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_mailboxes','mailboxes','private mailbox, private mailboxes, pmb',true,true,7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_po_box','po box','po boxes, post office box',true,true,8,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_printing','printing','print services, digital printing, wide-format printing, print shop',true,true,9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_copying','copying','copies, photocopying',true,true,10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_notary','notary','notary public, notarization, notarize',true,true,11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_passport_photos','passport photos','passport photo',true,true,12,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_fingerprinting','fingerprinting','live scan, livescan',true,true,13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_shredding','shredding','document shredding',true,true,14,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_laminating','laminating','lamination',true,true,15,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_binding','binding','document binding',true,true,16,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_signs','signs','signage, banners',true,true,17,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_business_cards','business cards','business card',true,true,18,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_freight','freight','ltl freight, ltl',true,true,19,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_crating','crating','custom crating',true,true,20,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_moving_supplies','moving supplies','moving boxes',true,true,21,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_last_mile','last mile','last-mile delivery, last mile delivery',true,true,22,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_dimensional_weight','dimensional weight','dim weight',true,true,23,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_carriers','carriers','carrier',true,true,24,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_usps','USPS','usps, postal service, us postal service, united states postal service',true,true,25,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_ups','UPS','',true,true,26,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_fedex','FedEx','fedex, fed ex',true,true,27,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_dhl','DHL','',true,true,28,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_amazon','Amazon','',true,true,29,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_peak_season','peak season','holiday shipping, holiday season',true,true,30,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_small_business','small business','small businesses',true,true,31,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_franchise','franchise','franchising, franchisee, franchisees',true,true,32,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_point_of_sale','point of sale','pos system, point-of-sale',true,true,33,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_gift_wrapping','gift wrapping','gift wrap',true,true,34,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_greeting_cards','greeting cards','greeting card',true,true,35,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_package_acceptance','package acceptance','package receiving, hold for pickup',true,true,36,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_faxing','faxing','fax services',true,true,37,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tg_scanning','scanning','document scanning',true,true,38,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
