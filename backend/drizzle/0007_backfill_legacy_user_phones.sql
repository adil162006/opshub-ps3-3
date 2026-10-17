UPDATE "users"
SET "phone_number" = '+919' || lpad((floor(random() * 1000000000))::bigint::text, 9, '0'),
    "is_verified" = true,
    "updated_at" = now()
WHERE "phone_number" IS NULL OR "is_verified" = false;
