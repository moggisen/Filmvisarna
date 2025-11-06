CREATE TABLE IF NOT EXISTS booking_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  op ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  screening_id INT NOT NULL,
  seat_id INT NOT NULL,
  ticketType_id INT NULL,
  booking_id INT NULL,
  payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_screening_id (screening_id),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB;

DELIMITER $$

DROP TRIGGER IF EXISTS bxs_ai $$
CREATE TRIGGER bxs_ai AFTER INSERT ON bookingsXseats
FOR EACH ROW
BEGIN
  INSERT INTO booking_events(op, screening_id, seat_id, ticketType_id, booking_id, payload)
  VALUES (
    'INSERT',
    NEW.screening_id, NEW.seat_id, NEW.ticketType_id, NEW.booking_id,
    JSON_OBJECT('screening_id', NEW.screening_id, 'seat_id', NEW.seat_id)
  );
END $$

DROP TRIGGER IF EXISTS bxs_au $$
CREATE TRIGGER bxs_au AFTER UPDATE ON bookingsXseats
FOR EACH ROW
BEGIN
  INSERT INTO booking_events(op, screening_id, seat_id, ticketType_id, booking_id, payload)
  VALUES (
    'UPDATE',
    NEW.screening_id, NEW.seat_id, NEW.ticketType_id, NEW.booking_id,
    JSON_OBJECT(
      'old', JSON_OBJECT('ticketType_id', OLD.ticketType_id, 'booking_id', OLD.booking_id),
      'new', JSON_OBJECT('ticketType_id', NEW.ticketType_id, 'booking_id', NEW.booking_id),
      'seat_id', NEW.seat_id, 'screening_id', NEW.screening_id
    )
  );
END $$

DROP TRIGGER IF EXISTS bxs_ad $$
CREATE TRIGGER bxs_ad AFTER DELETE ON bookingsXseats
FOR EACH ROW
BEGIN
  INSERT INTO booking_events(op, screening_id, seat_id, ticketType_id, booking_id, payload)
  VALUES (
    'DELETE',
    OLD.screening_id, OLD.seat_id, OLD.ticketType_id, OLD.booking_id,
    JSON_OBJECT('screening_id', OLD.screening_id, 'seat_id', OLD.seat_id)
  );
END $$

DELIMITER ;
