//seed
import mysql from 'mysql2/promise';
import 'dotenv/config';
const cut = (s, max) => (s ?? '').toString().slice(0, max);

//films
const filmsRaw = [
  {
    title: 'DEADPOOL & WOLVERINE',
    year: 2024,
    age: '15',
    minutes: 127,
    synopsis: 'Deadpool och Wolverine tvingas samarbeta mot ett mystiskt multiversumhot. Brutal action, humor och fjärde väggen-brott.',
    directors: ['Shawn Levy'],
    actors: ['Ryan Reynolds','Hugh Jackman','Emma Corrin','Morena Baccarin'],
    genres: ['Action','Adventure','Sci-Fi','Comedy']
  },
  {
    title: 'GUARDIANS OF THE GALAXY Vol.3',
    year: 2023,
    age: '11',
    minutes: 150,
    synopsis: 'Teamet återförenas för ett sista äventyr som testar vänskap och mod. Humor, hjärta och spektakulär action.',
    directors: ['James Gunn'],
    actors: ['Chris Pratt','Zoe Saldana','Dave Bautista','Karen Gillan','Pom Klementieff'],
    genres: ['Action','Adventure','Sci-Fi','Comedy']
  },
  {
    title: 'SPIDER-MAN: ACROSS THE SPIDER-VERSE',
    year: 2023,
    age: '7',
    minutes: 140,
    synopsis: 'Miles Morales i ett nytt dimensionellt äventyr med flera Spider-varianter. Visuellt nydanande, starka teman.',
    directors: ['Joaquim Dos Santos','Kemp Powers','Justin K. Thompson'],
    actors: ['Shameik Moore','Hailee Steinfeld','Brian Tyree Henry'],
    genres: ['Action','Adventure','Sci-Fi','Animation']
  },
  {
    title: 'DOCTOR STRANGE: MULTIVERSE OF MADNESS',
    year: 2022,
    age: '11',
    minutes: 126,
    synopsis: 'Strange navigerar multiversumets faror efter No Way Home; Scarlet Witch har egna motiv. Skräckinfluerad Marvel-action.',
    directors: ['Sam Raimi'],
    actors: ['Benedict Cumberbatch','Elizabeth Olsen','Chiwetel Ejiofor','Rachel McAdams','Xochitl Gomez'],
    genres: ['Action','Adventure','Sci-Fi','Fantasy']
  },
  {
    title: 'SPIDER-MAN: NO WAY HOME',
    year: 2021,
    age: '11',
    minutes: 148,
    synopsis: 'Peters identitet avslöjas. Han söker hjälp av Dr. Strange, multiversumet öppnas och gamla hjältar/fiender återvänder.',
    directors: ['Jon Watts'],
    actors: ['Tom Holland','Zendaya','Benedict Cumberbatch','Tobey Maguire','Andrew Garfield'],
    genres: ['Action','Adventure','Sci-Fi']
  },
  {
    title: 'AVENGERS: ENDGAME',
    year: 2019,
    age: '11',
    minutes: 182,
    synopsis: 'Efter Infinity War försöker hjältarna återställa universum. Episk avslutning med stora uppoffringar.',
    directors: ['Anthony Russo','Joe Russo'],
    actors: ['Robert Downey Jr.','Chris Evans','Scarlett Johansson','Mark Ruffalo'],
    genres: ['Action','Adventure','Sci-Fi']
  },
  {
    title: 'AVENGERS: INFINITY WAR',
    year: 2019,
    age: '11',
    minutes: 149,
    synopsis: 'Thanos jagar alla Infinity Stones. Hjältarna ställs inför sina största prövningar.',
    directors: ['Anthony Russo','Joe Russo'],
    actors: ['Robert Downey Jr.','Chris Hemsworth','Mark Ruffalo','Josh Brolin'],
    genres: ['Action','Adventure','Sci-Fi']
  },
  {
    title: 'LOGAN',
    year: 2017,
    age: '15',
    minutes: 137,
    synopsis: 'En äldre Wolverine skyddar en ung mutant medan Xavier är sjuk. Mörkare, mer realistisk ton.',
    directors: ['James Mangold'],
    actors: ['Hugh Jackman','Patrick Stewart','Dafne Keen'],
    genres: ['Action','Drama','Adventure']
  },
  {
    title: 'THOR: RAGNAROK',
    year: 2017,
    age: '11',
    minutes: 118,
    synopsis: 'Thor måste rädda Asgård från Hela och överleva gladiatorarenan. Humoristisk och färgstark stil.',
    directors: ['Taika Waititi'],
    actors: ['Chris Hemsworth','Tom Hiddleston','Cate Blanchett','Jeff Goldblum'],
    genres: ['Action','Adventure','Sci-Fi','Comedy']
  },
  {
    title: 'VENOM',
    year: 2018,
    age: '15',
    minutes: 112,
    synopsis: 'Eddie Brock blir värd för symbioten Venom. Action, skräck och svart humor.',
    directors: ['Ruben Fleischer'],
    actors: ['Tom Hardy','Michelle Williams','Riz Ahmed'],
    genres: ['Action','Sci-Fi']
  },
  {
    title: 'DEADPOOL',
    year: 2016,
    age: '15',
    minutes: 108,
    synopsis: 'Wade Wilson blir Deadpool – antihjälte med självläkning och sylvass humor. Fjärde väggen-brott.',
    directors: ['Tim Miller'],
    actors: ['Ryan Reynolds','Morena Baccarin','T.J. Miller'],
    genres: ['Action','Comedy','Sci-Fi']
  },
  {
    title: 'CAPTAIN AMERICA: CIVIL WAR',
    year: 2016,
    age: '11',
    minutes: 136,
    synopsis: 'Konflikt mellan Cap och Iron Man när regeringen vill reglera hjältar. Teman om lojalitet och ansvar.',
    directors: ['Anthony Russo','Joe Russo'],
    actors: ['Chris Evans','Robert Downey Jr.','Scarlett Johansson','Chadwick Boseman','Tom Holland'],
    genres: ['Action','Adventure','Sci-Fi']
  },
  {
    title: 'GUARDIANS OF THE GALAXY',
    year: 2014,
    age: '11',
    minutes: 120,
    synopsis: 'Ett udda gäng måste stoppa en galaktisk tyrann. Humor, action och ikoniskt soundtrack.',
    directors: ['James Gunn'],
    actors: ['Chris Pratt','Zoe Saldana','Dave Bautista','Bradley Cooper','Vin Diesel'],
    genres: ['Action','Adventure','Sci-Fi','Comedy']
  },
  {
    title: 'CAPTAIN AMERICA: THE WINTER SOLDIER',
    year: 2014,
    age: '11',
    minutes: 136,
    synopsis: 'Cap avslöjar en konspiration inom S.H.I.E.L.D. Thrillerkänsla och politiska undertoner.',
    directors: ['Anthony Russo','Joe Russo'],
    actors: ['Chris Evans','Scarlett Johansson','Sebastian Stan','Anthony Mackie'],
    genres: ['Action','Adventure','Sci-Fi']
  },
  {
    title: 'IRON MAN 3',
    year: 2013,
    age: '11',
    minutes: 130,
    synopsis: 'Tony Stark kämpar med ångest och möter Mandarin. Action, humor och personlig utveckling.',
    directors: ['Shane Black'],
    actors: ['Robert Downey Jr.','Gwyneth Paltrow','Don Cheadle','Guy Pearce','Ben Kingsley'],
    genres: ['Action','Adventure','Sci-Fi']
  }
];

//runtime
const toRuntime = (min) => {
  const h = Math.floor(min / 60);
  const m = (min % 60).toString().padStart(2,'0');
  return `${h}h${m}m`;
};

//map
const movies = filmsRaw.map(f => ({
  movie_title: f.title,
  movie_desc: f.synopsis,
  movie_playtime: toRuntime(f.minutes),
  movie_director: f.directors.join(', '),
  movie_cast: f.actors.join(', '),
  movie_premier: `${f.year}-01-01`,
  movie_poster: '',
  movie_trailer: '',
  age_limit: parseInt(f.age, 10)
}));

//conn
const connCfg = {
  host: process.env.DB_HOST || 'localhost',
  port: +(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Filmvisarna'
};

//sql
const sql = `INSERT INTO movies
(movie_title,movie_desc,movie_playtime,movie_director,movie_cast,movie_premier,movie_poster,movie_trailer,age_limit)
VALUES (?,?,?,?,?,?,?,?,?)`;

//run
const seed = async () => {
  const conn = await mysql.createConnection(connCfg);
  try {
    // optional: log only
    console.log('[seed] inserting', movies.length, 'rows');

    for (const m of movies) {
      await conn.execute(sql, [
        m.movie_title,
        m.movie_desc,
        m.movie_playtime,
        m.movie_director,
        m.movie_cast,
        m.movie_premier,
        m.movie_poster,
        m.movie_trailer,
        m.age_limit
      ]);
    await conn.execute(sql, [
  cut(m.movie_title, 50),     
  m.movie_desc,               
  cut(m.movie_playtime, 10),  
  cut(m.movie_director, 50),  
  cut(m.movie_cast, 255),     
  cut(m.movie_premier, 10),   
  cut(m.movie_poster, 50),    
  cut(m.movie_trailer, 50),   
  m.age_limit                 
]);

    }

    console.log('[seed] done');
  } catch (e) {
    console.error('[seed] error', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
};

seed();