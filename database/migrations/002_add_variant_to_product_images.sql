ALTER TABLE product_images
  ADD COLUMN product_variant_id BIGINT UNSIGNED NULL AFTER product_id,
  ADD INDEX idx_product_images_variant_id (product_variant_id),
  ADD CONSTRAINT fk_product_images_variant
    FOREIGN KEY (product_variant_id)
    REFERENCES product_variants(id)
    ON DELETE SET NULL;