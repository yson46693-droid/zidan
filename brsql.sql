-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Feb 17, 2026 at 08:29 PM
-- Server version: 11.8.3-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u486977009_zidan_v1`
--

-- --------------------------------------------------------

--
-- Table structure for table `brsql`
--

CREATE TABLE `brsql` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `logo` varchar(255) DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `brsql`
--

INSERT INTO `brsql` (`id`, `name`, `logo`, `deleted_at`, `created_at`, `updated_at`) VALUES
(1, 'Samsung', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(2, 'Apple', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(3, 'Xiaomi', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(4, 'Oppo', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(5, 'vivo', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(6, 'Huawei', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(7, 'Realme', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(8, 'OnePlus', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(9, 'Google', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(10, 'Motorola', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(11, 'Nokia', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(12, 'Tecno', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(13, 'Infinix', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(14, 'Lenovo', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(15, 'Sony', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(16, 'Asus', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(17, 'ZTE', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(18, 'Meizu', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(19, 'HTC', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(20, 'Microsoft', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(21, 'Acer', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(22, 'alcatel', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07'),
(23, 'Lava', NULL, NULL, '2025-12-30 22:40:07', '2025-12-30 22:40:07');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `brsql`
--
ALTER TABLE `brsql`
  ADD PRIMARY KEY (`id`),
  ADD KEY `name` (`name`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `brsql`
--
ALTER TABLE `brsql`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
