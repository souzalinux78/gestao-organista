CREATE TABLE `ciclo_itens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `igreja_id` int NOT NULL,
  `ciclo_id` int DEFAULT NULL,
  `numero_ciclo` int NOT NULL,
  `organista_id` int NOT NULL,
  `posicao` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_ciclo_igreja_organista` (`igreja_id`,`numero_ciclo`,`organista_id`),
  KEY `idx_ciclo_itens_igreja_ciclo` (`igreja_id`,`numero_ciclo`),
  KEY `idx_ciclo_itens_organista` (`organista_id`),
  KEY `ciclo_id` (`ciclo_id`),
  CONSTRAINT `ciclo_itens_ibfk_1` FOREIGN KEY (`igreja_id`) REFERENCES `igrejas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ciclo_itens_ibfk_2` FOREIGN KEY (`organista_id`) REFERENCES `organistas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ciclo_itens_ibfk_3` FOREIGN KEY (`ciclo_id`) REFERENCES `ciclos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=178 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci