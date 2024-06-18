"use strict"

$(document).ready(function() {

	let divprogrammazione = $('#divprogrammazione');
	let btnModifiche = $("#modifiche");
	divprogrammazione.hide();
	btnModifiche.hide();
	getCinema();

    $("#modifica").on("click", function() {
		divprogrammazione.empty();
		getCinema();
		divprogrammazione.show();
		btnModifiche.show();
	});

	$("#aggiungi").on("click", function() {
		getCinema();
		divprogrammazione.empty();
		divprogrammazione.show();
		btnModifiche.show();
		let div = $("<div>");
		div.addClass("form-group");
		divprogrammazione.append(div);
		let b = $("<b>");
		b.html("film da aggiungere: ");
		div.append(b);
		let label = $("<label>");
		label.html("titolo: ");
		div.append(label);
		let input = $("<input>");
		input.attr("type", "text");
		div.append(input);
		label = $("<label>");
		label.html("numero proiezioni: ");
		div.append(label);
		input = $("<input>");
		input.attr("type", "text");
		div.append(input);
		divprogrammazione.append(div);
	});

	btnModifiche.on("click", function() {
		let film = [];
		divprogrammazione.children().each(function() {
			let titolo = $(this).find("input").eq(0).val();
			let numeroProiezioni = $(this).find("input").eq(1).val();
			numeroProiezioni = parseInt(numeroProiezioni);
			film.push({"titolo": titolo, "numeroProiezioni": numeroProiezioni});
		});
		console.log(film);
		let filmRQ = inviaRichiesta('POST', '/api/aggiornaprogrammazione', {"film": film});
		filmRQ.then(function(response) {
			console.log(response.data);
			if(response.data.ris == "ok")
			{
				alert("Programmazione aggiornata correttamente");
				divprogrammazione.hide().empty();
				btnModifiche.hide();
			}
		})
		filmRQ.catch(errore);
	});

	function getCinema() {
		let cinemaRQ = inviaRichiesta('GET', '/api/getcinemaadmin');
		cinemaRQ.then(function(response) {
			let filmcinema = response.data.programmazione;
			console.log(filmcinema);
			let i = 0;
			for(let film of filmcinema)
			{
				i++;
				let div = $("<div>");
				div.addClass("form-group");
				let b = $("<b>");
				b.html("film" + i);
				div.append(b);
				let label = $("<label>");
				label.html("titolo: ");
				div.append(label);
				let input = $("<input>");
				input.val(film.titolo);
				input.attr("type", "text");
				div.append(input);
				label = $("<label>");
				label.html("numero proiezioni: ");
				div.append(label);
				input = $("<input>");
				input.val(film.numeroProiezioni);
				input.attr("type", "text");
				div.append(input);
				let button = $("<button>");
				button.html("Elimina");
				button.addClass("btn btn-danger");
				button.on("click", function() {
					let filmRQ = inviaRichiesta('POST', '/api/eliminafilm', {"film": film});
					filmRQ.then(function(response) {
						console.log(response.data);
						if(response.data.ris == "ok")
						{
							alert("Film eliminato correttamente");
							divprogrammazione.empty();
							getCinema();
						}
					})
					filmRQ.catch(errore);
				});
				div.append(button);
				divprogrammazione.append(div);
			}
		})
		cinemaRQ.catch(errore)
	}


    

    /* ************************* LOGOUT  *********************** */

    /*  Per il logout è inutile inviare una richiesta al server.
		E' sufficiente cancellare il cookie o il token dal pc client.
		Se però si utilizzano i cookies la gestione dei cookies lato client 
		è trasparente, per cui in quel caso occorre inviare una req al server */
		
	$("#btnLogout").on("click", function() {
		localStorage.removeItem("token")
        window.location.href = "login.html"
	});
	
});