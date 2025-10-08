CREATE DATABASE IF NOT EXISTS Filmvisarna;
USE Filmvisarna;

CREATE TABLE users (
    user_id VARCHAR(50) PRIMARY KEY,
    user_email VARCHAR(50) NOT NULL UNIQUE,
    user_password_hash VARCHAR(255) NOT NULL,
    user_name VARCHAR(50),
    user_phoneNumber VARCHAR(20) UNIQUE
);

CREATE TABLE movies (
    movie_id INT AUTO_INCREMENT PRIMARY KEY,
    movie_title VARCHAR(50) NOT NULL UNIQUE,
    movie_desc TEXT NOT NULL,
    movie_playtime VARCHAR(10) NOT NULL,
    movie_director VARCHAR(50) NOT NULL,
    movie_cast VARCHAR(255) NOT NULL,
    movie_premier VARCHAR(10) NOT NULL,
    movie_poster VARCHAR(50) NOT NULL,
    movie_trailer VARCHAR(50) NOT NULL
);

CREATE TABLE auditoriums (
    auditorium_id INT AUTO_INCREMENT PRIMARY KEY,
    auditorium_name VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE ticketTypes (
    ticketType_id INT AUTO_INCREMENT PRIMARY KEY,
    ticketType_name VARCHAR(20) NOT NULL UNIQUE,
    ticketType_price INT NOT NULL
);

CREATE TABLE screenings (
    screening_id INT AUTO_INCREMENT PRIMARY KEY,
    screening_time DATETIME NOT NULL,
    movie_id INT NOT NULL,
    auditorium_id INT NOT NULL,
    FOREIGN KEY (movie_id) REFERENCES movies(movie_id),
    FOREIGN KEY (auditorium_id) REFERENCES auditoriums(auditorium_id)
);

CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_time DATETIME NOT NULL,
    booking_confirmation VARCHAR(50) NOT NULL,
    screening_id INT NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    FOREIGN KEY (screening_id) REFERENCES screenings(screening_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE seats (
    seat_id INT AUTO_INCREMENT PRIMARY KEY,
    auditorium_id INT NOT NULL,
    FOREIGN KEY (auditorium_id) REFERENCES auditoriums(auditorium_id)
);

CREATE TABLE bookingsXseats (
    screening_id INT NOT NULL,
    seat_id INT NOT NULL,
    ticketType_id INT NOT NULL,
    booking_id INT NOT NULL,
    FOREIGN KEY (screening_id) REFERENCES screenings(screening_id),
    FOREIGN KEY (seat_id) REFERENCES seats(seat_id),
    FOREIGN KEY (ticketType_id) REFERENCES ticketTypes(ticketType_id),
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    PRIMARY KEY (screening_id, seat_id)
);