-- every business table carries site_id; RLS enforces it in PostgreSQL
CREATE TABLE sites (id text PRIMARY KEY, slug text UNIQUE NOT NULL, name text NOT NULL,
  draft jsonb NOT NULL, live_version int);
CREATE TABLE site_versions (site_id text REFERENCES sites, v int, config jsonb NOT NULL,
  note text, created_by uuid, created_at timestamptz DEFAULT now(), PRIMARY KEY (site_id, v));
CREATE TABLE users (id uuid PRIMARY KEY, email text UNIQUE, password_hash text, global_role text);
CREATE TABLE site_members (site_id text REFERENCES sites, user_id uuid REFERENCES users,
  role text CHECK (role IN ('Member','Manager','Admin')), PRIMARY KEY (site_id, user_id));
CREATE TABLE inventory (id uuid PRIMARY KEY, site_id text NOT NULL REFERENCES sites,
  data jsonb NOT NULL, qty numeric NOT NULL CHECK (qty >= 0), UNIQUE (site_id, id));
CREATE TABLE requests (id uuid PRIMARY KEY, site_id text NOT NULL REFERENCES sites,
  item_id uuid, status text, step int, data jsonb,
  FOREIGN KEY (site_id, item_id) REFERENCES inventory (site_id, id));  -- same-site refs only
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_isolation ON inventory
  USING (site_id = current_setting('app.site_id'));  -- SET LOCAL per request
