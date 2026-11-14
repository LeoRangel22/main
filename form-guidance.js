(() => {
"use strict";
const quickFormatCopy = {
  pt: {
    title: "Que formato você imagina?", help: "Escolha uma direção. Você pode ajustar depois ou pedir ajuda.",
    options: [["Café da manhã / coffee break", "Manhã em dias úteis"], ["Coquetel / confraternização", "A partir das 17h; sábado, das 18h"], ["Outro formato / preciso de ajuda", "A equipe ajuda a definir"]],
    morning: "Café da manhã e coffee break: prefira a manhã de segunda a sexta.", weekend: "Sua data é no fim de semana. A equipe confirma as alternativas.",
    cocktail: "Para coquetéis, sugerimos chegada a partir das 17h; aos sábados, das 18h.", saturday: "No sábado, sugerimos coquetel a partir das 18h.",
    outside: "Seu horário fica fora dessa sugestão. Você pode manter o pedido para consulta à equipe.", other: "Almoço, workshop e outras experiências continuam disponíveis para consulta em Personalizar.",
  },
  en: {
    title: "What format do you have in mind?", help: "Choose a starting point. You can adjust it later or ask for help.",
    options: [["Breakfast / coffee break", "Weekday mornings"], ["Cocktail reception / gathering", "From 5pm; Saturdays, from 6pm"], ["Another format / I need help", "Our team can help you choose"]],
    morning: "For breakfast and coffee breaks, prefer Monday to Friday mornings.", weekend: "Your date is on a weekend. Our team will confirm the alternatives.",
    cocktail: "For cocktails, we suggest arrival from 5pm; on Saturdays, from 6pm.", saturday: "On Saturdays, we suggest cocktails from 6pm.",
    outside: "Your time is outside this suggestion. You can keep it for our team to review.", other: "Lunch, workshops and other experiences remain available for consultation under Personalize.",
  },
  es: {
    title: "¿Qué formato tienes en mente?", help: "Elige una opción inicial. Puedes ajustarla después o pedir ayuda.",
    options: [["Desayuno / pausa para café", "Mañanas de lunes a viernes"], ["Cóctel / encuentro", "Desde las 17h; sábados, desde las 18h"], ["Otro formato / necesito ayuda", "El equipo te ayuda a elegir"]],
    morning: "Para desayunos y pausas para café, recomendamos las mañanas de lunes a viernes.", weekend: "Tu fecha es en fin de semana. El equipo confirmará las alternativas.",
    cocktail: "Para cócteles, sugerimos llegar desde las 17h; los sábados, desde las 18h.", saturday: "Los sábados, sugerimos cócteles desde las 18h.",
    outside: "Tu horario está fuera de esta sugerencia. Puedes mantenerlo para que el equipo lo revise.", other: "Almuerzos, talleres y otras experiencias siguen disponibles para consulta en Personalizar.",
  },
};

function render({ language, selected, date: dateValue, time }) {
  const text = quickFormatCopy[language] || quickFormatCopy.pt;
  const route = ["breakfast", "coffee"].includes(selected) ? "breakfast" : selected === "cocktail" ? "cocktail" : selected ? "recommendation" : "";
  document.getElementById("quickFormatTitle").textContent = text.title;
  document.getElementById("quickFormatHelp").textContent = text.help;
  document.querySelectorAll("[data-quick-format]").forEach((button, index) => {
    button.querySelector("strong").textContent = text.options[index][0];
    button.querySelector("span").textContent = text.options[index][1];
    button.setAttribute("aria-pressed", String(button.dataset.quickFormat === route));
  });
  const date = dateValue ? new Date(dateValue + "T12:00:00") : null;
  const day = date && !Number.isNaN(date.getTime()) ? date.getDay() : null;
  const threshold = day === 6 ? "18:00" : "17:00";
  const advice = route === "breakfast"
    ? [text.morning, day === 0 || day === 6 ? text.weekend : "", time && time >= "11:00" ? text.outside : ""]
    : route === "cocktail" ? [day === 6 ? text.saturday : text.cocktail, time && time < threshold ? text.outside : ""]
    : route ? [text.other] : [];
  const node = document.getElementById("quickFormatAdvice"), value = advice.filter(Boolean).join(" ");
  if (node.textContent !== value) node.textContent = value;
}

window.EventFormGuidance = Object.freeze({ render });
})();
