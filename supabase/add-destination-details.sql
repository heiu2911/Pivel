-- TravelQuest: mở rộng nội dung chi tiết cho từng địa danh.
-- Chạy trong Supabase Dashboard -> SQL Editor.
-- An toàn chạy lại: chỉ thêm cột nếu thiếu và không ghi đè trường đã có nội dung.

ALTER TABLE public.checkpoints
  ADD COLUMN IF NOT EXISTS history text,
  ADD COLUMN IF NOT EXISTS architecture text,
  ADD COLUMN IF NOT EXISTS distinctive_feature text,
  ADD COLUMN IF NOT EXISTS fun_fact text,
  ADD COLUMN IF NOT EXISTS slogan text;

-- Tách các mục được ghi nhãn rõ ràng trong mô tả hiện có.
-- Nếu nguồn không có mục tương ứng thì để trống, không tự tạo dữ kiện lịch sử/fun fact.
UPDATE public.checkpoints AS c
SET
  history = COALESCE(
    NULLIF(btrim(c.history), ''),
    NULLIF(
      btrim(
        (regexp_match(
          COALESCE(c.description, ''),
          '(?is)(?:Lịch sử hình thành|Lịch sử địa chất|Lịch sử)\s*:\s*(.*?)(?=\s*(?:Kiến trúc(?:\s*/\s*Cảnh quan|\s*[–-]\s*cảnh quan)?|Điểm đặc trưng nhất là|Điểm thú vị|Fun fact|Slogan)\s*:|$)'
        ))[1]
      ),
      ''
    ),
    NULLIF(btrim(c.description), '')
  ),
  architecture = COALESCE(
    NULLIF(btrim(c.architecture), ''),
    NULLIF(
      btrim(
        (regexp_match(
          COALESCE(c.description, ''),
          '(?is)Kiến trúc(?:\s*/\s*Cảnh quan|\s*[–-]\s*cảnh quan)?\s*:\s*(.*?)(?=\s*(?:Lịch sử hình thành|Lịch sử địa chất|Lịch sử|Điểm đặc trưng nhất là|Điểm thú vị|Fun fact|Slogan)\s*:|$)'
        ))[1]
      ),
      ''
    )
  ),
  distinctive_feature = COALESCE(
    NULLIF(btrim(c.distinctive_feature), ''),
    NULLIF(
      btrim(
        (regexp_match(
          COALESCE(c.description, ''),
          '(?is)(?:Điểm đặc trưng nhất là|Điểm nổi bật)\s*:\s*(.*?)(?=\s*(?:Lịch sử hình thành|Lịch sử địa chất|Lịch sử|Kiến trúc(?:\s*/\s*Cảnh quan|\s*[–-]\s*cảnh quan)?|Điểm thú vị|Fun fact|Slogan)\s*:|$)'
        ))[1]
      ),
      ''
    )
  ),
  fun_fact = COALESCE(
    NULLIF(btrim(c.fun_fact), ''),
    NULLIF(
      btrim(
        (regexp_match(
          COALESCE(c.description, ''),
          '(?is)(?:Điểm thú vị|Fun fact)\s*:\s*(.*?)(?=\s*(?:Lịch sử hình thành|Lịch sử địa chất|Lịch sử|Kiến trúc(?:\s*/\s*Cảnh quan|\s*[–-]\s*cảnh quan)?|Điểm đặc trưng nhất là|Slogan)\s*:|$)'
        ))[1]
      ),
      ''
    )
  ),
  slogan = COALESCE(
    NULLIF(btrim(c.slogan), ''),
    'Khám phá ' || c.name || ' – lưu giữ dấu ấn Việt Nam.'
  );

-- Kiểm tra số địa danh và số mục chi tiết đã có nội dung.
SELECT
  COUNT(*) AS total_destinations,
  COUNT(NULLIF(btrim(history), '')) AS with_history,
  COUNT(NULLIF(btrim(architecture), '')) AS with_architecture,
  COUNT(NULLIF(btrim(distinctive_feature), '')) AS with_distinctive_feature,
  COUNT(NULLIF(btrim(fun_fact), '')) AS with_fun_fact,
  COUNT(NULLIF(btrim(slogan), '')) AS with_slogan
FROM public.checkpoints;
