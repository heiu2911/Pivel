-- TravelQuest: mở rộng nội dung chi tiết cho từng địa danh.
-- Chạy trong Supabase Dashboard -> SQL Editor.
-- Không xóa dữ liệu hiện có; chỉ thêm cột còn thiếu và điền dữ liệu có thể tách từ description.

ALTER TABLE public.checkpoints
  ADD COLUMN IF NOT EXISTS history text,
  ADD COLUMN IF NOT EXISTS architecture text,
  ADD COLUMN IF NOT EXISTS distinctive_feature text,
  ADD COLUMN IF NOT EXISTS fun_fact text,
  ADD COLUMN IF NOT EXISTS slogan text;

-- Tách những mục đã được ghi nhãn trong description hiện có.
-- Nếu mô tả không có nhãn tương ứng, cột được để trống để bổ sung sau,
-- thay vì bịa ra dữ kiện lịch sử hoặc fun fact.
UPDATE public.checkpoints AS c
SET
  history = COALESCE(
    c.history,
    NULLIF(
      btrim(
        (regexp_match(
          COALESCE(c.description, ''),
          '(?is)(?:Lịch sử hình thành|Lịch sử địa chất|Lịch sử)\s*:\s*(.*?)(?:Kiến trúc(?:\s*/\s*Cảnh quan|\s*[–-]\s*cảnh quan)?|Điểm đặc trưng nhất là|Điểm thú vị|Fun fact|Slogan)\s*:'
        ))[1]
      ),
      ''
    ),
    NULLIF(btrim(c.description), '')
  ),
  architecture = COALESCE(
    c.architecture,
    NULLIF(
      btrim(
        (regexp_match(
          COALESCE(c.description, ''),
          '(?is)Kiến trúc(?:\s*/\s*Cảnh quan|\s*[–-]\s*cảnh quan)?\s*:\s*(.*?)(?:Điểm đặc trưng nhất là|Điểm thú vị|Fun fact|Slogan)\s*:'
        ))[1]
      ),
      ''
    )
  ),
  distinctive_feature = COALESCE(
    c.distinctive_feature,
    NULLIF(
      btrim(
        (regexp_match(
          COALESCE(c.description, ''),
          '(?is)Điểm đặc trưng nhất là\s*:\s*(.*?)(?:Điểm thú vị|Fun fact|Slogan)\s*:'
        ))[1]
      ),
      ''
    )
  ),
  fun_fact = COALESCE(
    c.fun_fact,
    NULLIF(
      btrim(
        (regexp_match(
          COALESCE(c.description, ''),
          '(?is)(?:Điểm thú vị|Fun fact)\s*:\s*(.*?)(?:Slogan\s*:|$)'
        ))[1]
      ),
      ''
    )
  ),
  slogan = COALESCE(
    NULLIF(btrim(c.slogan), ''),
    'Khám phá ' || c.name || ' – lưu giữ dấu ấn Việt Nam.'
  );

-- Kiểm tra số lượng địa danh và các trường chi tiết sau khi cập nhật.
SELECT
  COUNT(*) AS total_destinations,
  COUNT(history) AS with_history,
  COUNT(architecture) AS with_architecture,
  COUNT(distinctive_feature) AS with_distinctive_feature,
  COUNT(fun_fact) AS with_fun_fact,
  COUNT(slogan) AS with_slogan
FROM public.checkpoints;
