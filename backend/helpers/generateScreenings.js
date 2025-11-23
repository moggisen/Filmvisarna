import axios from "axios";

const API_URL = "http://localhost:5001/api/screenings";

const startDate = new Date("2025-11-26");
const endDate = new Date("2025-12-31");

const times = ["12:00:00", "16:00:00", "20:00:00"];
const auditoriums = [1, 2];
const movieIds = Array.from({ length: 15 }, (_, i) => i + 1); // 15 filmer

// Hjälpfunktion: slumpa element från en array
function getRandomElements(array, count) {
  const copy = [...array];
  const selected = [];
  for (let i = 0; i < count; i++) {
    const index = Math.floor(Math.random() * copy.length);
    selected.push(copy.splice(index, 1)[0]);
  }
  return selected;
}

async function createScreenings() {
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];

    // Slumpa 2 filmer för dagen
    const todaysMovies = getRandomElements(movieIds, 2);

    for (const movie of todaysMovies) {
      // Varje film får 2 olika visningstider (slumpade)
      const todaysTimes = getRandomElements(times, 2);

      for (const time of todaysTimes) {
        const screeningTime = `${dateStr} ${time}`;
        const auditorium =
          auditoriums[Math.floor(Math.random() * auditoriums.length)];

        const screening = {
          screening_time: screeningTime,
          movie_id: movie,
          auditorium_id: auditorium,
        };

        try {
          await axios.post(API_URL, screening);
          console.log(
            `${screeningTime} | Film ${movie} | Salong ${auditorium}`
          );
        } catch (err) {
          console.error("Fel vid skapande:", err.response?.data || err.message);
        }
      }
    }
  }

  console.log("🎉 Alla screenings skapade!");
}

createScreenings();
