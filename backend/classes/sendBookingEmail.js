// sendBookingEmail.js
import sendEmail from "./sendEmail.js"; // Import av default-exporten

/**
 * Skickar ett bekräftelsemejl till kunden efter en lyckad bokning.
 * @param {object} bookingData - Objekt med all bokningsinformation.
 */

async function sendBookingEmail({
  to,
  confirmation,
  movieTitle,
  auditoriumName,
  seatList,
  screeningTime,
  totalPrice,
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
     <p>
          <img 
            src="https://i.imgur.com/xDDrdTT.png" 
            alt="Filmvisarnas logotyp" 
            style="max-width: 150px; height: auto; margin-bottom: 5px;"
          />
      </p>
      <h2 style="color:#f44336; border-bottom: 2px solid #eee; padding-bottom: 10px;">🎟️ Bekräftelse på din bokning</h2>
      <p>Tack för att du bokade hos <strong>Filmvisarna</strong>!</p>

      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Bokningsnummer:</strong> <span style="font-weight: bold; color: #f44336;">${confirmation}</span><br>
        (Ange de 6 första tecknen i din kod vid insläppet)</p>
      </div>

      <p><strong>Film:</strong> ${movieTitle}<br>
      <strong>Salong:</strong> ${auditoriumName}<br>
      <strong>Platser:</strong> ${seatList}<br>
      <strong>Visningstid:</strong> ${screeningTime}<br>
      <strong>Totalt pris:</strong> <span style="font-weight: bold;">${totalPrice} kr</span></p>

      <p style="margin-top: 25px;">Välkommen till Filmvisarna och njut av filmen 🎬</p>
      
   <p> Som medlem sker avbokning på mina sidor. Som Ickemedlem vänligen kontaka oss på 000-12345 eller mejla filmvisarna38@gmail.com</p>
   
   <p>
          <img 
            src="" 
            alt="Filmvisarnas logotyp" 
            style="max-width: 150px; height: auto; margin-bottom: 15px;"
          />
      </p>
      </div>
  `;

  const text = `
    Bekräftelse på din bokning hos Filmvisarna.
    Bokningsnummer: ${confirmation}
    Film: ${movieTitle}
    Salong: ${auditoriumName}
    Platser: ${seatList}
    Visningstid: ${screeningTime}
    Totalt pris: ${totalPrice} kr
  `;

  await sendEmail({
    to,
    subject: "Bekräftelse på din bokning 🎬",
    text,
    html,
  });
}

export { sendBookingEmail };
