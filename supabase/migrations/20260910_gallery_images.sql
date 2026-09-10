-- Gallery images for Pictures page (public read; admin write via website task)

CREATE TABLE IF NOT EXISTS public.gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,
  url text NOT NULL,
  storage_path text,
  alt text NOT NULL DEFAULT 'East Canyon Resort',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gallery_images_section_sort_idx
  ON public.gallery_images (section, sort_order, created_at);

ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read gallery images" ON public.gallery_images;
CREATE POLICY "Anyone can read gallery images"
  ON public.gallery_images
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert gallery images" ON public.gallery_images;
CREATE POLICY "Admins can insert gallery images"
  ON public.gallery_images
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_admin_task('website'));

DROP POLICY IF EXISTS "Admins can update gallery images" ON public.gallery_images;
CREATE POLICY "Admins can update gallery images"
  ON public.gallery_images
  FOR UPDATE
  TO authenticated
  USING (public.has_admin_task('website'))
  WITH CHECK (public.has_admin_task('website'));

DROP POLICY IF EXISTS "Admins can delete gallery images" ON public.gallery_images;
CREATE POLICY "Admins can delete gallery images"
  ON public.gallery_images
  FOR DELETE
  TO authenticated
  USING (public.has_admin_task('website'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery',
  'gallery',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read gallery storage" ON storage.objects;
CREATE POLICY "Public read gallery storage"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'gallery');

DROP POLICY IF EXISTS "Admins upload gallery storage" ON storage.objects;
CREATE POLICY "Admins upload gallery storage"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND public.has_admin_task('website'));

DROP POLICY IF EXISTS "Admins update gallery storage" ON storage.objects;
CREATE POLICY "Admins update gallery storage"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'gallery' AND public.has_admin_task('website'))
  WITH CHECK (bucket_id = 'gallery' AND public.has_admin_task('website'));

DROP POLICY IF EXISTS "Admins delete gallery storage" ON storage.objects;
CREATE POLICY "Admins delete gallery storage"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'gallery' AND public.has_admin_task('website'));

-- Seed existing Pictures page images (relative pix/gallery URLs)
INSERT INTO public.gallery_images (section, url, alt, sort_order)
SELECT * FROM (VALUES
  ('Around the resort', 'pix/gallery/slideshow-01.jpg', 'Aerial view of East Canyon Resort', 0),
  ('Around the resort', 'pix/gallery/slideshow-02.jpg', 'East Canyon Resort grounds', 1),
  ('Around the resort', 'pix/gallery/slideshow-03.jpg', 'RV camping at East Canyon Resort', 2),
  ('Around the resort', 'pix/gallery/slideshow-04.jpg', 'Condominiums at East Canyon Resort', 3),
  ('Around the resort', 'pix/gallery/slideshow-05.jpg', 'Recreation at East Canyon Resort', 4),
  ('Around the resort', 'pix/gallery/slideshow-06.jpg', 'East Canyon Resort', 5),
  ('Around the resort', 'pix/gallery/slideshow-07.jpg', 'East Canyon Resort', 6),
  ('Around the resort', 'pix/gallery/slideshow-08.jpg', 'Wilderness at East Canyon Resort', 7),
  ('Around the resort', 'pix/gallery/slideshow-09.jpg', 'East Canyon Resort', 8),
  ('Around the resort', 'pix/gallery/slideshow-10.jpg', 'East Canyon Resort', 9),
  ('Around the resort', 'pix/gallery/slideshow-11.jpg', 'East Canyon Resort', 10),
  ('Around the resort', 'pix/gallery/slideshow-12.jpg', 'East Canyon Resort', 11),
  ('Canyons and seasons', 'pix/gallery/slideshow-13.jpg', 'East Canyon Resort', 0),
  ('Canyons and seasons', 'pix/gallery/slideshow-14.jpg', 'East Canyon Resort', 1),
  ('Canyons and seasons', 'pix/gallery/slideshow-15.jpg', 'East Canyon Resort', 2),
  ('Canyons and seasons', 'pix/gallery/slideshow-16.jpg', 'East Canyon Resort', 3),
  ('Canyons and seasons', 'pix/gallery/slideshow-17.jpg', 'East Canyon Resort', 4),
  ('Canyons and seasons', 'pix/gallery/slideshow-18.jpg', 'East Canyon Resort', 5),
  ('Canyons and seasons', 'pix/gallery/slideshow-19.jpg', 'East Canyon Resort', 6),
  ('Canyons and seasons', 'pix/gallery/slideshow-20.jpg', 'East Canyon Resort', 7),
  ('Canyons and seasons', 'pix/gallery/slideshow-21.jpg', 'East Canyon Resort', 8),
  ('Canyons and seasons', 'pix/gallery/slideshow-22.jpg', 'East Canyon Resort', 9),
  ('Canyons and seasons', 'pix/gallery/slideshow-23.jpg', 'East Canyon Resort', 10),
  ('Canyons and seasons', 'pix/gallery/slideshow-24.jpg', 'East Canyon Resort', 11),
  ('Canyons and seasons', 'pix/gallery/web-03.jpg', 'Mountain view near East Canyon Resort', 12),
  ('Canyons and seasons', 'pix/gallery/ta-04.jpg', 'East Canyon landscape', 13),
  ('Lodging, courts, and events', 'pix/gallery/ecr-01.jpg', 'East Canyon Resort', 0),
  ('Lodging, courts, and events', 'pix/gallery/ecr-02.jpg', 'East Canyon Resort', 1),
  ('Lodging, courts, and events', 'pix/gallery/ecr-03.jpg', 'East Canyon Resort', 2),
  ('Lodging, courts, and events', 'pix/gallery/ecr-04.jpg', 'East Canyon Resort', 3),
  ('Lodging, courts, and events', 'pix/gallery/ecr-05.jpg', 'East Canyon Resort', 4),
  ('Lodging, courts, and events', 'pix/gallery/ecr-06.jpg', 'East Canyon Resort', 5),
  ('Lodging, courts, and events', 'pix/gallery/ecr-07.jpg', 'East Canyon Resort', 6),
  ('Lodging, courts, and events', 'pix/gallery/ecr-08.jpg', 'East Canyon Resort', 7),
  ('Lodging, courts, and events', 'pix/gallery/ecr-09.jpg', 'East Canyon Resort', 8),
  ('Lodging, courts, and events', 'pix/gallery/ecr-10.jpg', 'East Canyon Resort', 9),
  ('Lodging, courts, and events', 'pix/gallery/ecr-11.jpg', 'East Canyon Resort', 10),
  ('Lodging, courts, and events', 'pix/gallery/ecr-12.jpg', 'East Canyon Resort', 11),
  ('Lodging, courts, and events', 'pix/gallery/ecr-13.jpg', 'East Canyon Resort', 12),
  ('Lodging, courts, and events', 'pix/gallery/ecr-16.jpg', 'East Canyon Resort', 13),
  ('Lodging, courts, and events', 'pix/gallery/ecr-20.jpg', 'East Canyon Resort', 14),
  ('Lodging, courts, and events', 'pix/gallery/web-01.jpg', 'Sports courts at East Canyon Resort', 15),
  ('Lodging, courts, and events', 'pix/gallery/web-02.jpg', 'Condo buildings at East Canyon Resort', 16),
  ('Lodging, courts, and events', 'pix/gallery/web-04.jpg', 'Outdoor wedding setup at East Canyon Resort', 17),
  ('Lodging, courts, and events', 'pix/gallery/web-05.jpg', 'East Canyon Resort', 18),
  ('Lodging, courts, and events', 'pix/gallery/web-06.jpg', 'East Canyon Resort', 19),
  ('Lodging, courts, and events', 'pix/gallery/fb-01.jpg', 'Patriotic parade at East Canyon Resort', 20),
  ('From eastcanyon.com', 'pix/gallery/d30ccf_b004e77eb5a049309083f14c1df97606~mv2.jpg', 'East Canyon Resort', 0),
  ('From eastcanyon.com', 'pix/gallery/41df96_2f7043cf00a948e186e430c8bfd521fc~mv2.jpg', 'East Canyon Resort', 1),
  ('From eastcanyon.com', 'pix/gallery/3325e1_95c78d9f4f45417daef6af73efe1d1dc~mv2.jpg', 'East Canyon Resort', 2),
  ('From eastcanyon.com', 'pix/gallery/3325e1_1e0cb075be7248cd9a5d2f3ed26a40ae~mv2.jpg', 'East Canyon Resort', 3),
  ('From eastcanyon.com', 'pix/gallery/3325e1_c5f6e6dae52141b1bb699a3a522a2198~mv2.jpg', 'East Canyon Resort', 4),
  ('From eastcanyon.com', 'pix/gallery/3325e1_8d81f9f21ef44e5d8cf5a613716fa685~mv2.jpg', 'East Canyon Resort', 5),
  ('From eastcanyon.com', 'pix/gallery/3325e1_ceea8410c9c943d4978df6221cd40383~mv2.jpg', 'East Canyon Resort', 6),
  ('From eastcanyon.com', 'pix/gallery/3325e1_0a51dded14034700965d6960ba877a2d~mv2.jpg', 'East Canyon Resort', 7),
  ('From eastcanyon.com', 'pix/gallery/3325e1_88d0ef2f330944218e4fb0ccb5b14fe3~mv2.jpg', 'East Canyon Resort', 8),
  ('From eastcanyon.com', 'pix/gallery/3325e1_2afd0b7e08e9432abe51b196be01be7e~mv2.jpg', 'East Canyon Resort', 9),
  ('From eastcanyon.com', 'pix/gallery/3325e1_41b0002e9e914503827003cf4c5b7210~mv2.jpg', 'East Canyon Resort', 10),
  ('From eastcanyon.com', 'pix/gallery/3325e1_25e6b95036464d909dc1ca39ca0c388a~mv2.jpg', 'East Canyon Resort', 11),
  ('From eastcanyon.com', 'pix/gallery/11062b_add41d056f974341a232dae6f010b2f7~mv2.jpg', 'East Canyon Resort', 12),
  ('From eastcanyon.com', 'pix/gallery/3325e1_546edae9b0204c52909a59062deeede1~mv2.jpg', 'East Canyon Resort', 13),
  ('From eastcanyon.com', 'pix/gallery/11062b_77bc831f356a48c4883112fcf1602a6a~mv2_d_4586_3057_s_4_2.jpg', 'East Canyon Resort', 14),
  ('From eastcanyon.com', 'pix/gallery/497204a05fa24e94814dfd4a3efa71af.jpg', 'East Canyon Resort', 15),
  ('From eastcanyon.com', 'pix/gallery/ab48db_1663cf8dedaa4871bff7c95000a29f53~mv2.png', 'East Canyon Resort', 16),
  ('From eastcanyon.com', 'pix/gallery/ab48db_0af51847887540fcb616761be52e6879~mv2.png', 'East Canyon Resort', 17),
  ('From eastcanyon.com', 'pix/gallery/41df96_84c655ce34b741c095647db858f52c18~mv2.jpg', 'East Canyon Resort', 18),
  ('From eastcanyon.com', 'pix/gallery/41df96_cba1c3465488447a8aa48e8cc8b8e013~mv2.jpg', 'East Canyon Resort', 19),
  ('From eastcanyon.com', 'pix/gallery/41df96_a5eaabc41366418c9fa952c4ebd52dbe~mv2.jpg', 'East Canyon Resort', 20),
  ('From eastcanyon.com', 'pix/gallery/3325e1_762addf8f6e34d5a92926ceb525b6475~mv2.jpg', 'East Canyon Resort', 21),
  ('From eastcanyon.com', 'pix/gallery/3325e1_7d84c6f8ea1f48118a2aa52e653dba13~mv2.jpg', 'East Canyon Resort', 22),
  ('From eastcanyon.com', 'pix/gallery/3325e1_e5e92f882abe467990d33442fa1ed829~mv2.jpg', 'East Canyon Resort', 23),
  ('From eastcanyon.com', 'pix/gallery/3325e1_471b8ac95ef443d49a52d19916a6ae93~mv2.jpg', 'East Canyon Resort', 24),
  ('From eastcanyon.com', 'pix/gallery/3325e1_b261b481647f4e09bd94c6bfd6b1e32a~mv2.jpg', 'East Canyon Resort', 25),
  ('From eastcanyon.com', 'pix/gallery/3325e1_880313e2358149c2a5fe38d3f904a62d~mv2.jpg', 'East Canyon Resort', 26),
  ('From eastcanyon.com', 'pix/gallery/3325e1_568e9ab9fc74486cbb24f567c7223785~mv2.jpg', 'East Canyon Resort', 27),
  ('From eastcanyon.com', 'pix/gallery/3325e1_d3b154346e6544958bb74084edf095f6~mv2.jpg', 'East Canyon Resort', 28),
  ('From eastcanyon.com', 'pix/gallery/3325e1_77b502612b1b4fd8b63d859ce10e87e0~mv2.jpg', 'East Canyon Resort', 29),
  ('From eastcanyon.com', 'pix/gallery/3325e1_f3c07f8612864e3bb0bd85540879861a~mv2.jpg', 'East Canyon Resort', 30),
  ('From eastcanyon.com', 'pix/gallery/3325e1_4dc26eac9dfc4973b32eeeece84f00cd~mv2.jpg', 'East Canyon Resort', 31),
  ('From eastcanyon.com', 'pix/gallery/3325e1_6f96aef31ffa4467bdda4d09172ed122~mv2.jpg', 'East Canyon Resort', 32),
  ('From eastcanyon.com', 'pix/gallery/3325e1_b886c418bcdd4454b4d5ae6a0257b662~mv2.jpg', 'East Canyon Resort', 33),
  ('From eastcanyon.com', 'pix/gallery/3325e1_bbaeddd793c24b7b9ce78cd4d4b41b40~mv2.jpg', 'East Canyon Resort', 34),
  ('From eastcanyon.com', 'pix/gallery/3325e1_c0d09e57a8e743dea85fc048a8da6f92~mv2.jpg', 'East Canyon Resort', 35),
  ('From eastcanyon.com', 'pix/gallery/322a1e_c237554153904d92aeb2b20d22bca3d8~mv2.jpeg', 'East Canyon Resort', 36),
  ('From eastcanyon.com', 'pix/gallery/322a1e_9544114d4cda4ec0ba136ed669028d36~mv2.jpeg', 'East Canyon Resort', 37),
  ('From eastcanyon.com', 'pix/gallery/322a1e_03fe50d38f624fd6abb708265b2d4c7d~mv2.jpeg', 'East Canyon Resort', 38),
  ('From eastcanyon.com', 'pix/gallery/322a1e_6ce91953c77b41c99f37553bafb6d20e~mv2.jpeg', 'East Canyon Resort', 39),
  ('From eastcanyon.com', 'pix/gallery/322a1e_b66d7e30bee946648ecb1369202cb14d~mv2.jpeg', 'East Canyon Resort', 40),
  ('From eastcanyon.com', 'pix/gallery/322a1e_2e8d6900a6a34ad28216e64859a7563c~mv2.jpeg', 'East Canyon Resort', 41),
  ('From eastcanyon.com', 'pix/gallery/322a1e_0b122a970d53437c89e84738e85225d0~mv2.jpeg', 'East Canyon Resort', 42),
  ('From eastcanyon.com', 'pix/gallery/322a1e_0c6c5f1a94e940e69e4bc693fab7377b~mv2.jpeg', 'East Canyon Resort', 43),
  ('From eastcanyon.com', 'pix/gallery/322a1e_4cfaa157e651475097cb02588590a178~mv2.jpeg', 'East Canyon Resort', 44),
  ('From eastcanyon.com', 'pix/gallery/3325e1_8cf8a7f50ff440ad808f9491db13d42d~mv2.jpg', 'East Canyon Resort', 45),
  ('From eastcanyon.com', 'pix/gallery/41df96_62048ff31267450dba15c0b752a4c193~mv2.jpg', 'East Canyon Resort', 46),
  ('From eastcanyon.com', 'pix/gallery/3325e1_bc7365925e6b4e149ed21671b81a8f9c~mv2.jpg', 'East Canyon Resort', 47),
  ('From eastcanyon.com', 'pix/gallery/030154_61f706db3e434632a6f983084cea9b57~mv2.jpg', 'East Canyon Resort', 48),
  ('From eastcanyon.com', 'pix/gallery/030154_bbde9204a1cd4bc696ddd59c039a703b~mv2.jpg', 'East Canyon Resort', 49),
  ('From eastcanyon.com', 'pix/gallery/030154_009d1e5f9bca4b60baf7bdd49bb10b7f~mv2.png', 'East Canyon Resort', 50),
  ('From eastcanyon.com', 'pix/gallery/3325e1_72b909f3179b43e9ac93cc0b9846b3b9~mv2.jpg', 'East Canyon Resort', 51),
  ('From eastcanyon.com', 'pix/gallery/3325e1_08f9db095598496c9af76c3e5c4de33e~mv2.png', 'East Canyon Resort', 52),
  ('From eastcanyon.com', 'pix/gallery/3325e1_e01a552a576347f6b9e399588cdb2d85~mv2.jpg', 'East Canyon Resort', 53),
  ('From eastcanyon.com', 'pix/gallery/3325e1_68c54cd220eb4feeb0fe51a08c4eed99~mv2.jpg', 'East Canyon Resort', 54),
  ('From eastcanyon.com', 'pix/gallery/03f22a3cb4d543b9b7ffcaae2f53a15f.jpg', 'East Canyon Resort', 55),
  ('From eastcanyon.com', 'pix/gallery/3325e1_8e25665923e547d699c51ef9832942a8~mv2.jpg', 'East Canyon Resort', 56),
  ('From eastcanyon.com', 'pix/gallery/3325e1_e5e43c16322f4bf99b07c5ab510845ee~mv2.jpg', 'East Canyon Resort', 57),
  ('From eastcanyon.com', 'pix/gallery/3325e1_d6cd210c6f564004858c00e2963bc70d~mv2.jpg', 'East Canyon Resort', 58),
  ('From eastcanyon.com', 'pix/gallery/11062b_569d42f6215f4a86a9b15e094153ef07~mv2.jpg', 'East Canyon Resort', 59),
  ('From eastcanyon.com', 'pix/gallery/11062b_880c7b78f2784cb48e182e145a301663~mv2.jpeg', 'East Canyon Resort', 60),
  ('From eastcanyon.com', 'pix/gallery/5efd91ceb2334b4aa63e177d144f4168.jpg', 'East Canyon Resort', 61),
  ('From eastcanyon.com', 'pix/gallery/11062b_96389bff455d4304b03d504a15b9d088~mv2.jpg', 'East Canyon Resort', 62),
  ('From eastcanyon.com', 'pix/gallery/11062b_3d09206d2bd94b279e8bcf535904a42a~mv2.jpeg', 'East Canyon Resort', 63),
  ('From eastcanyon.com', 'pix/gallery/3325e1_dfcecbd6148243609e2ad4b0ba0c3c84~mv2.jpg', 'East Canyon Resort', 64),
  ('From eastcanyon.com', 'pix/gallery/3325e1_54e163fe03fe49b189e9939befc6d1f5~mv2.jpg', 'East Canyon Resort', 65),
  ('From eastcanyon.com', 'pix/gallery/3325e1_7dd447b28d9741859031e7a4a3b0c22c~mv2.jpg', 'East Canyon Resort', 66),
  ('From eastcanyon.com', 'pix/gallery/3325e1_611f7878d6204dfca8544309804c424b~mv2.jpg', 'East Canyon Resort', 67),
  ('From eastcanyon.com', 'pix/gallery/3325e1_83f097daaa5347a093d5c1c4c2426de8~mv2.jpg', 'East Canyon Resort', 68),
  ('From eastcanyon.com', 'pix/gallery/3325e1_4136644b8c1f471cae04105078ccba66~mv2.jpg', 'East Canyon Resort', 69),
  ('From eastcanyon.com', 'pix/gallery/11062b_85b622bf411b4cd780f88866dd38aca1~mv2.jpg', 'East Canyon Resort', 70),
  ('From eastcanyon.com', 'pix/gallery/11062b_730f622ee1fc4429b7f4a99c42365710~mv2.jpg', 'East Canyon Resort', 71),
  ('From eastcanyon.com', 'pix/gallery/11062b_39e247b72968464ebe5aa7a3d652631d~mv2.jpg', 'East Canyon Resort', 72),
  ('From eastcanyon.com', 'pix/gallery/3325e1_a789df074b5848b0ba11664fbd2d0e7f~mv2.jpg', 'East Canyon Resort', 73),
  ('From eastcanyon.com', 'pix/gallery/3325e1_562fe299448248b0b7334e727d44793a~mv2.jpeg', 'East Canyon Resort', 74),
  ('From eastcanyon.com', 'pix/gallery/3325e1_e91db6f56ad94232898863f9808c6c06~mv2.jpeg', 'East Canyon Resort', 75),
  ('From eastcanyon.com', 'pix/gallery/41df96_ab152d75afb74f0ab76f0ce8ba9c0fd9~mv2.png', 'East Canyon Resort', 76),
  ('From eastcanyon.com', 'pix/gallery/11062b_bb8766c7484e43a8bb67f5ee010f6e09~mv2.jpeg', 'East Canyon Resort', 77),
  ('From eastcanyon.com', 'pix/gallery/06c4e0b8cf09405cb6fe47d91b4ffda4.jpg', 'East Canyon Resort', 78),
  ('From eastcanyon.com', 'pix/gallery/41df96_979d720ffe57427a81af7bb67b039813~mv2.jpg', 'East Canyon Resort', 79),
  ('From eastcanyon.com', 'pix/gallery/41df96_8b011a394a1844bfa45ba7e83e1f5bf2~mv2.jpg', 'East Canyon Resort', 80),
  ('From eastcanyon.com', 'pix/gallery/eec35aaa1daa4711bc495f350762e21d.jpg', 'East Canyon Resort', 81),
  ('From eastcanyon.com', 'pix/gallery/41df96_b9d6b4b6496946b1b9332ce2ba41acad~mv2.png', 'East Canyon Resort', 82),
  ('From eastcanyon.com', 'pix/gallery/41df96_916c4bc57814484080054aebddd33944~mv2.png', 'East Canyon Resort', 83),
  ('From eastcanyon.com', 'pix/gallery/af9daef5b5684a679caf003614294ccd.jpg', 'East Canyon Resort', 84),
  ('From eastcanyon.com', 'pix/gallery/d30ccf_472bd0fc553e4a2a852c1847898dfe63~mv2.jpg', 'East Canyon Resort', 85),
  ('From eastcanyon.com', 'pix/gallery/3325e1_74aff53e6d3d43d5b74249bd8f206b6d~mv2.jpg', 'East Canyon Resort', 86),
  ('From eastcanyon.com', 'pix/gallery/030154_8efabe3b7eab449cbe4d407a2351e6eb~mv2.jpg', 'East Canyon Resort', 87),
  ('From eastcanyon.com', 'pix/gallery/3325e1_a9c4c89e40fc4e5899894cec2ff77b87~mv2.jpg', 'East Canyon Resort', 88),
  ('From eastcanyon.com', 'pix/gallery/41df96_3d3e38c56d9d4777b9a9323dff11e86b~mv2.jpg', 'East Canyon Resort', 89),
  ('From eastcanyon.com', 'pix/gallery/3325e1_49ec942f850245ee9bd0075f5e7ec8ce~mv2.jpg', 'East Canyon Resort', 90),
  ('From eastcanyon.com', 'pix/gallery/3325e1_e554b42408294c2a8a1ec8f439dff12d~mv2.jpg', 'East Canyon Resort', 91),
  ('From eastcanyon.com', 'pix/gallery/3325e1_d88279d50ae547588296942f815e4a6c~mv2.jpg', 'East Canyon Resort', 92),
  ('From eastcanyon.com', 'pix/gallery/3325e1_0617573d75ab4742a0b06423069426be~mv2.jpg', 'East Canyon Resort', 93),
  ('From eastcanyon.com', 'pix/gallery/3325e1_0f4bd55bc78546c88f8be8a675ede0ec~mv2.jpg', 'East Canyon Resort', 94),
  ('From eastcanyon.com', 'pix/gallery/3325e1_ffe1b6940f3b4fec863ab38810de4d85~mv2.jpg', 'East Canyon Resort', 95),
  ('From eastcanyon.com', 'pix/gallery/3325e1_331a48d4ae7648ef975cbad33b20658c~mv2.jpg', 'East Canyon Resort', 96),
  ('From eastcanyon.com', 'pix/gallery/3325e1_8021a38a0c3b43399d845b3268509fba~mv2.jpg', 'East Canyon Resort', 97),
  ('From eastcanyon.com', 'pix/gallery/3325e1_9d57abd18b2048c7a2f968e8ce7a6bec~mv2.jpg', 'East Canyon Resort', 98),
  ('From eastcanyon.com', 'pix/gallery/3325e1_d3f75851709641b7bb8465c06fddef53~mv2.jpg', 'East Canyon Resort', 99),
  ('From eastcanyon.com', 'pix/gallery/3325e1_7b2251d2e13541e981d45d4cc3a724d8~mv2.jpg', 'East Canyon Resort', 100),
  ('From eastcanyon.com', 'pix/gallery/3325e1_e39b3eb4437d4886b859f10c67736e30~mv2.jpg', 'East Canyon Resort', 101),
  ('From eastcanyon.com', 'pix/gallery/3325e1_582bb5b7b04b4cc9bd7ac3df56c645d0~mv2.jpg', 'East Canyon Resort', 102),
  ('From eastcanyon.com', 'pix/gallery/3325e1_856d7e30c91b4e94b62c50b36de9c5ed~mv2.jpg', 'East Canyon Resort', 103),
  ('From eastcanyon.com', 'pix/gallery/3325e1_95a6dc732f204242a9344d62da336a75~mv2.jpg', 'East Canyon Resort', 104),
  ('From eastcanyon.com', 'pix/gallery/3325e1_ece30b218f114a189a5cff86f0449914~mv2.jpg', 'East Canyon Resort', 105),
  ('From eastcanyon.com', 'pix/gallery/3325e1_f2ed2ccec22846b4960bde5b81175a49~mv2.jpg', 'East Canyon Resort', 106),
  ('From eastcanyon.com', 'pix/gallery/3325e1_48ec516033654c8fbb9f5b7b2682ec44~mv2.jpg', 'East Canyon Resort', 107),
  ('From eastcanyon.com', 'pix/gallery/3325e1_9701520a1c784f6fb73a331328de231b~mv2.jpg', 'East Canyon Resort', 108),
  ('From eastcanyon.com', 'pix/gallery/3325e1_6b839c0013ec42b9823729365eb2e48e~mv2.jpg', 'East Canyon Resort', 109),
  ('From eastcanyon.com', 'pix/gallery/3325e1_38e344ab7fbf41a3b58503234c52f055~mv2.jpg', 'East Canyon Resort', 110),
  ('From eastcanyon.com', 'pix/gallery/3325e1_b4269e3941db42c49ac976900663b584~mv2.jpg', 'East Canyon Resort', 111),
  ('From eastcanyon.com', 'pix/gallery/3325e1_03b2b4de201245a1a78cac97153176dd~mv2.jpg', 'East Canyon Resort', 112),
  ('From eastcanyon.com', 'pix/gallery/3325e1_b37ad320acdd40d1bf31253284d7cc3d~mv2.jpg', 'East Canyon Resort', 113),
  ('From eastcanyon.com', 'pix/gallery/3325e1_ff26317892934051bc4d193267b04ae8~mv2.jpg', 'East Canyon Resort', 114),
  ('From eastcanyon.com', 'pix/gallery/3325e1_2f1a82aef4c64107aef9f9492de8abb5~mv2.jpg', 'East Canyon Resort', 115),
  ('From eastcanyon.com', 'pix/gallery/3325e1_9407c10731a14afea2906eb3ea8cc0f5~mv2.jpg', 'East Canyon Resort', 116),
  ('From eastcanyon.com', 'pix/gallery/3325e1_f82c8605fb514d9ca8a8540aa6214a1a~mv2.jpg', 'East Canyon Resort', 117),
  ('From eastcanyon.com', 'pix/gallery/3325e1_485d8576a9784a3b9976d98fb48cd871~mv2.jpg', 'East Canyon Resort', 118),
  ('From eastcanyon.com', 'pix/gallery/3325e1_65c89856193d4869b28b66aec3915e14~mv2.jpg', 'East Canyon Resort', 119),
  ('From eastcanyon.com', 'pix/gallery/3325e1_8e1f7f2b34834cddaeec60d0c8c7383d~mv2.jpg', 'East Canyon Resort', 120),
  ('From eastcanyon.com', 'pix/gallery/3325e1_57f8f64b454b44e09f014e6521ea6d19~mv2.jpg', 'East Canyon Resort', 121),
  ('From eastcanyon.com', 'pix/gallery/3325e1_8f35849348834584b04d5b591984c884~mv2.jpg', 'East Canyon Resort', 122),
  ('From eastcanyon.com', 'pix/gallery/3325e1_87e2ab56ecf54e36ab7e096d39b59446~mv2.jpg', 'East Canyon Resort', 123),
  ('From eastcanyon.com', 'pix/gallery/3325e1_92c2435147ca423181c5fd2b3c1a1362~mv2.jpg', 'East Canyon Resort', 124),
  ('From eastcanyon.com', 'pix/gallery/3325e1_c317b32c726d4faeab50b27f30e1152e~mv2.jpg', 'East Canyon Resort', 125),
  ('From eastcanyon.com', 'pix/gallery/3325e1_aeeeb81dd21c4b9c82827bf0e9e25d05~mv2.jpg', 'East Canyon Resort', 126),
  ('From eastcanyon.com', 'pix/gallery/3325e1_16945744f8304918a1d22850258fbfb6~mv2.jpg', 'East Canyon Resort', 127),
  ('From eastcanyon.com', 'pix/gallery/01c3aff52f2a4dffa526d7a9843d46ea.png', 'East Canyon Resort', 128),
  ('From eastcanyon.com', 'pix/gallery/c547d832354845ebbada2c001d6087d3.jpg', 'East Canyon Resort', 129),
  ('From eastcanyon.com', 'pix/gallery/3325e1_e88ecc8f817a4deea3d9239f7cc5ae53~mv2.jpg', 'East Canyon Resort', 130),
  ('From eastcanyon.com', 'pix/gallery/11062b_24fbc61307544501bc670b79c8858d14~mv2.jpeg', 'East Canyon Resort', 131),
  ('From eastcanyon.com', 'pix/gallery/11062b_d1b428cd5cb84a89b6cf87cf76dc9918~mv2.jpg', 'East Canyon Resort', 132),
  ('From eastcanyon.com', 'pix/gallery/3325e1_128a916dab8b46eaaaf15b84ed24c06a~mv2.jpg', 'East Canyon Resort', 133),
  ('From live-site documents', 'pix/gallery/pdf-030154_fc5806cf77f04d1ab3df20a8c12b587b-01.jpg', 'East Canyon Resort', 0),
  ('From live-site documents', 'pix/gallery/pdf-030154_fc5806cf77f04d1ab3df20a8c12b587b-02.jpg', 'East Canyon Resort', 1),
  ('From live-site documents', 'pix/gallery/pdf-030154_81f6da3f91774f51a5bd1782471faaf9-01.jpg', 'East Canyon Resort', 2),
  ('From live-site documents', 'pix/gallery/pdf-030154_81f6da3f91774f51a5bd1782471faaf9-02.jpg', 'East Canyon Resort', 3),
  ('From live-site documents', 'pix/gallery/pdf-030154_31a438196d4546f584d52af2caa3535a-01.jpg', 'East Canyon Resort', 4),
  ('From live-site documents', 'pix/gallery/pdf-030154_dfda45f882224e5e80d3fbdb937cf242-01.jpg', 'East Canyon Resort', 5),
  ('From live-site documents', 'pix/gallery/pdf-030154_dfda45f882224e5e80d3fbdb937cf242-02.jpg', 'East Canyon Resort', 6),
  ('From live-site documents', 'pix/gallery/pdf-41df96_e97deb32bbb54c05a7393a278cb47c17-01.jpg', 'East Canyon Resort', 7),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_c167970bf2ba46f18552f405b79ca939-01.jpg', 'East Canyon Resort', 8),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_c167970bf2ba46f18552f405b79ca939-02.jpg', 'East Canyon Resort', 9),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_69ad9f5f8f104580a4065f957fe83a19-01.jpg', 'East Canyon Resort', 10),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_69ad9f5f8f104580a4065f957fe83a19-02.jpg', 'East Canyon Resort', 11),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_69ad9f5f8f104580a4065f957fe83a19-03.jpg', 'East Canyon Resort', 12),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_69ad9f5f8f104580a4065f957fe83a19-04.jpg', 'East Canyon Resort', 13),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_a877fc45a52845a896effc87f3fb8856-01.jpg', 'East Canyon Resort', 14),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_a877fc45a52845a896effc87f3fb8856-02.jpg', 'East Canyon Resort', 15),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_a877fc45a52845a896effc87f3fb8856-03.jpg', 'East Canyon Resort', 16),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_a877fc45a52845a896effc87f3fb8856-04.jpg', 'East Canyon Resort', 17),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_a877fc45a52845a896effc87f3fb8856-05.jpg', 'East Canyon Resort', 18),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_a877fc45a52845a896effc87f3fb8856-06.jpg', 'East Canyon Resort', 19),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_5636adb0af5d42eca94f1d75e6826f77-01.jpg', 'East Canyon Resort', 20),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_5636adb0af5d42eca94f1d75e6826f77-02.jpg', 'East Canyon Resort', 21),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_5636adb0af5d42eca94f1d75e6826f77-03.jpg', 'East Canyon Resort', 22),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_5636adb0af5d42eca94f1d75e6826f77-04.jpg', 'East Canyon Resort', 23),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_d71489b416e84a3b95b48e9225fc5229-01.jpg', 'East Canyon Resort', 24),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_0b3a6db34ca947ba997ad6c6d3e61800-01.jpg', 'East Canyon Resort', 25),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_0b3a6db34ca947ba997ad6c6d3e61800-02.jpg', 'East Canyon Resort', 26),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_4d2cc70d6c2b48b29dd02ad521963e00-01.jpg', 'East Canyon Resort', 27),
  ('From live-site documents', 'pix/gallery/pdf-030154_0d0852acaf944b159187eefb0c76bc5d-01.jpg', 'East Canyon Resort', 28),
  ('From live-site documents', 'pix/gallery/pdf-030154_0d0852acaf944b159187eefb0c76bc5d-02.jpg', 'East Canyon Resort', 29),
  ('From live-site documents', 'pix/gallery/pdf-030154_0d0852acaf944b159187eefb0c76bc5d-03.jpg', 'East Canyon Resort', 30),
  ('From live-site documents', 'pix/gallery/pdf-030154_0d0852acaf944b159187eefb0c76bc5d-04.jpg', 'East Canyon Resort', 31),
  ('From live-site documents', 'pix/gallery/pdf-030154_0d0852acaf944b159187eefb0c76bc5d-05.jpg', 'East Canyon Resort', 32),
  ('From live-site documents', 'pix/gallery/pdf-030154_0d0852acaf944b159187eefb0c76bc5d-06.jpg', 'East Canyon Resort', 33),
  ('From live-site documents', 'pix/gallery/pdf-030154_0d0852acaf944b159187eefb0c76bc5d-07.jpg', 'East Canyon Resort', 34),
  ('From live-site documents', 'pix/gallery/pdf-030154_0d0852acaf944b159187eefb0c76bc5d-08.jpg', 'East Canyon Resort', 35),
  ('From live-site documents', 'pix/gallery/pdf-030154_0d0852acaf944b159187eefb0c76bc5d-09.jpg', 'East Canyon Resort', 36),
  ('From live-site documents', 'pix/gallery/pdf-030154_0d0852acaf944b159187eefb0c76bc5d-10.jpg', 'East Canyon Resort', 37),
  ('From live-site documents', 'pix/gallery/pdf-ea237d_b55536093143450aadd642cc4ead027f-01.jpg', 'East Canyon Resort', 38),
  ('From live-site documents', 'pix/gallery/pdf-ea237d_d9ba3686a1d14e0398805d869213fabe-01.jpg', 'East Canyon Resort', 39),
  ('From live-site documents', 'pix/gallery/pdf-ea237d_e80560e9652741eb8287adc19dd609aa-01.jpg', 'East Canyon Resort', 40),
  ('From live-site documents', 'pix/gallery/pdf-ea237d_e80560e9652741eb8287adc19dd609aa-02.jpg', 'East Canyon Resort', 41),
  ('From live-site documents', 'pix/gallery/pdf-41df96_dff86a8567024249b34d3aad392cdc57-01.jpg', 'East Canyon Resort', 42),
  ('From live-site documents', 'pix/gallery/pdf-d30ccf_23f8921b6cfc4983bc8f4d001b28a3ad-01.jpg', 'East Canyon Resort', 43),
  ('From live-site documents', 'pix/gallery/pdf-d30ccf_23f8921b6cfc4983bc8f4d001b28a3ad-02.jpg', 'East Canyon Resort', 44),
  ('From live-site documents', 'pix/gallery/pdf-d30ccf_23f8921b6cfc4983bc8f4d001b28a3ad-03.jpg', 'East Canyon Resort', 45),
  ('From live-site documents', 'pix/gallery/pdf-d30ccf_23f8921b6cfc4983bc8f4d001b28a3ad-04.jpg', 'East Canyon Resort', 46),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_65c10e47f8944439ac5b453b38479120-01.jpg', 'East Canyon Resort', 47),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_65c10e47f8944439ac5b453b38479120-02.jpg', 'East Canyon Resort', 48),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_ebafe2f6770346d3980f64544fe74340-01.jpg', 'East Canyon Resort', 49),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_ebafe2f6770346d3980f64544fe74340-02.jpg', 'East Canyon Resort', 50),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_ebafe2f6770346d3980f64544fe74340-03.jpg', 'East Canyon Resort', 51),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_ebafe2f6770346d3980f64544fe74340-04.jpg', 'East Canyon Resort', 52),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_ebafe2f6770346d3980f64544fe74340-05.jpg', 'East Canyon Resort', 53),
  ('From live-site documents', 'pix/gallery/pdf-3325e1_ebafe2f6770346d3980f64544fe74340-06.jpg', 'East Canyon Resort', 54)
) AS v(section, url, alt, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.gallery_images LIMIT 1);
