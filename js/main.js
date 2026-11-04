// Seleção dos elementos HTML
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const districtFilter = document.getElementById("districtFilter");
const eventsList = document.getElementById("eventsList");
const eventCount = document.getElementById("eventCount");
const locationButton = document.getElementById("locationButton");

// Modal e Formulário
const modal = document.getElementById("eventModal");
const addEventButton = document.getElementById("addEventButton");
const closeModal = document.getElementById("closeModal");
const eventForm = document.getElementById("eventForm");
const eventImageInput = document.getElementById("eventImage");

// Apresentar os eventos no painel lateral
function displayEvents(list) {
    eventsList.innerHTML = "";
    eventCount.textContent = list.length;

    list.forEach(event => {
        const card = document.createElement("div");
        card.classList.add("event-card");

        const imageHTML = event.image 
            ? `<img src="${event.image}" alt="${event.name}" class="event-image">` 
            : "";

        card.innerHTML = `
            ${imageHTML}
            <span class="category">${event.category}</span>
            <h4>${event.name}</h4>
            <p>📅 ${event.date} · ${event.time}</p>
            <p>📍 ${event.location}</p>
        `;

        card.addEventListener("click", function() {
            if (typeof map !== 'undefined') {
                map.setView([event.latitude, event.longitude], 16);
            }
        });

        eventsList.appendChild(card);
    });
}

// Filtragem de eventos (pesquisa, categoria e distrito)
function filterEvents() {
    const search = searchInput.value.toLowerCase();
    const category = categoryFilter.value;
    const district = districtFilter.value;

    const filtered = events.filter(event => {
        const matchesSearch = event.name.toLowerCase().includes(search);
        const matchesCategory = category === "all" || event.category === category;
        const matchesDistrict = district === "all" || event.distrito === district;

        return matchesSearch && matchesCategory && matchesDistrict;
    });

    displayEvents(filtered);
    
    if (typeof showEventsOnMap === 'function') {
        showEventsOnMap(filtered);
    }
}

// Event listeners para a pesquisa e filtros
searchInput.addEventListener("input", filterEvents);
categoryFilter.addEventListener("change", filterEvents);
districtFilter.addEventListener("change", filterEvents);

locationButton.addEventListener("click", function() {
    if (typeof showUserLocation === 'function') {
        showUserLocation();
    }
});

// Controlo de abertura/fecho do modal
addEventButton.addEventListener("click", function() {
    modal.classList.remove("hidden");
});

closeModal.addEventListener("click", function() {
    modal.classList.add("hidden");
});

modal.addEventListener("click", function(event) {
    if (event.target === modal) {
        modal.classList.add("hidden");
    }
});

// Adicionar novos eventos e processar o upload da imagem
eventForm.addEventListener("submit", function(e) {
    e.preventDefault();

    if (!selectedLat || !selectedLng) {
        alert("Por favor, clica primeiro no mapa para escolher a localização exata do evento.");
        return;
    }

    const file = eventImageInput.files[0];
    if (file) {
        const reader = new FileReader();
        
        reader.onload = function(eventResult) {
            const imageUrl = eventResult.target.result;
            publishEvent(imageUrl);
        };
        
        reader.readAsDataURL(file);
    }
});

function publishEvent(imageUrl) {
    const newEvent = {
        id: events.length + 1,
        name: document.getElementById("eventName").value,
        description: document.getElementById("eventDescription").value,
        category: document.getElementById("eventCategory").value,
        date: document.getElementById("eventDate").value,
        time: document.getElementById("eventTime").value,
        location: document.getElementById("eventLocation").value,
        distrito: document.getElementById("eventFormDistrict").value,
        latitude: selectedLat,
        longitude: selectedLng,
        image: imageUrl
    };

    events.push(newEvent);
    filterEvents();

    eventForm.reset();
    modal.classList.add("hidden");
    
    const coordsText = document.getElementById("selectedCoordinates");
    coordsText.textContent = "📍 Nenhuma localização selecionada no mapa";
    coordsText.style.color = "#666";
    coordsText.style.fontWeight = "normal";
    
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
        selectedLat = null;
        selectedLng = null;
    }

    alert("Evento adicionado com sucesso!");
}

// ==========================================
// SISTEMA DE AUTENTICAÇÃO (LocalStorage)
// ==========================================
const authScreen = document.getElementById('authScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterBtn = document.getElementById('showRegister');
const showLoginBtn = document.getElementById('showLogin');
const logoutButton = document.getElementById('logoutButton');

showRegisterBtn.addEventListener('click', function(e) {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
});

showLoginBtn.addEventListener('click', function(e) {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

registerForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const user = document.getElementById('regUser').value.trim();
    const pass = document.getElementById('regPass').value;
    
    if (localStorage.getItem("user_" + user)) {
        alert('Este utilizador já existe! Escolhe outro nome.');
    } else {
        localStorage.setItem("user_" + user, pass);
        alert('Conta criada com sucesso! Podes iniciar sessão.');
        registerForm.reset();
        showLoginBtn.click();
    }
});

loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    
    const savedPass = localStorage.getItem("user_" + user);
    
    if (savedPass && savedPass === pass) {
        localStorage.setItem('currentUser', user);
        checkAuth();
    } else {
        alert('Utilizador ou palavra-passe incorretos.');
    }
});

logoutButton.addEventListener('click', function() {
    localStorage.removeItem('currentUser');
    checkAuth();
});

function checkAuth() {
    const currentUser = localStorage.getItem('currentUser');
    
    if (currentUser) {
        authScreen.classList.add('hidden');
        logoutButton.classList.remove('hidden');
        
        if (typeof map !== 'undefined') {
            setTimeout(() => map.invalidateSize(), 100);
        }
    } else {
        authScreen.classList.remove('hidden');
        logoutButton.classList.add('hidden');
        loginForm.reset();
        registerForm.reset();
    }
}

// Executar funções iniciais
displayEvents(events);
checkAuth();