-- P1: remove quick reply category (simplify model)
DROP INDEX IF EXISTS quick_replies_agent_category_idx;
ALTER TABLE quick_replies DROP COLUMN IF EXISTS category;
