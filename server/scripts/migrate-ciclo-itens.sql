-- Migração: Tabela ciclo_itens para Gestão de Ciclos
-- Uma igreja com N cultos tem N ciclos (listas ordenadas de organistas).
-- Cada ciclo pode ter organistas em posições diferentes (ex: Ciclo 1 pos 5, Ciclo 2 pos 1).

CREATE TABLE IF NOT EXISTS ciclo_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  igreja_id INT NOT NULL,
  numero_ciclo INT NOT NULL COMMENT '1, 2, 3... conforme quantidade de cultos',
  organista_id INT NOT NULL,
  posicao INT NOT NULL COMMENT 'Ordem na fila deste ciclo (1-based ou 0-based conforme uso)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (igreja_id) REFERENCES igrejas(id) ON DELETE CASCADE,
  FOREIGN KEY (organista_id) REFERENCES organistas(id) ON DELETE CASCADE,
  UNIQUE KEY unique_ciclo_igreja_organista (igreja_id, numero_ciclo, organista_id),
  INDEX idx_ciclo_itens_igreja_ciclo (igreja_id, numero_ciclo),
  INDEX idx_ciclo_itens_organista (organista_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
