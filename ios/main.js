document.addEventListener("DOMContentLoaded", () => {
    const userAgent = window.navigator.userAgent;
    
    // Detecta si el usuario está en un iPhone o iPad
    if (/iPhone|iPad/i.test(userAgent)) {
        // Redirige automáticamente al modelo en AR
        window.location.href = "edadsolar_10.usdz";
    } else {
        alert("Esta experiencia de AR solo está disponible en iPhone o iPad.");
    }
});
