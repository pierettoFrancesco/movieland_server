"use strict"
$(document).ready(function() {

	let tBody = $('#tabMail tbody');

    $("#cinema").on("click", function() {
		getCinema();
		$("#divpreferiti").hide();
		$("#divwatchlist").hide();
		$("#divcinema").empty().show();

	});

	$("#watchlist").on("click", function() {
		getWatchlist();
		$("#divcinema").hide();
		$("#divpreferiti").hide();
		$("#divwatchlist").empty().show();
	});

	$("#preferiti").on("click", function() {
		getPreferiti();
		$("#divcinema").hide();
		$("#divwatchlist").hide();
		$("#divpreferiti").empty().show();
	});

    function getCinema() {
		let cinemaRQ = inviaRichiesta('GET', '/api/getcinema', );
		cinemaRQ.then(function(response) {
			console.log(response.data);
			let divcinema = $("#divcinema");
			for(let i = 0; i < response.data.length; i++) 
			{
				let div = $("<div>");
				divcinema.append(div);
				let p = $("<p>").text("nome: " + response.data[i].nome);
				div.append(p);
				p = $("<p>").text("luogo: " + response.data[i].luogo);
				div.append(p);
				p = $("<p>").text("numero sale: " + response.data[i].sale);
				div.append(p);
			}
		})
		cinemaRQ.catch(errore)
	}

	function getPreferiti() {
		let preferitiRQ = inviaRichiesta('GET', '/api/getpreferiti', );
		preferitiRQ.then(function(response) {
			console.log(response.data[0].Preferiti);
			let films = response.data[0].Preferiti;
			let divwatchlist = $("#divpreferiti");
			for(let film of films)
			{
				console.log(film.NomeFilm);
				let div = $("<div>");
				divwatchlist.append(div);
				let p = $("<p>").text("nome: " + film.NomeFilm);
				div.append(p);
			}
		})
		preferitiRQ.catch(errore)
	}

    function getWatchlist() {
		let watchlistRQ = inviaRichiesta('GET', '/api/getwatchlist', );
		watchlistRQ.then(function(response) {
			console.log(response.data[0].Preferiti);
			let films = response.data[0].Preferiti;
			let divwatchlist = $("#divwatchlist");
			for(let film of films)
			{
				console.log(film.NomeFilm);
				let div = $("<div>");
				divwatchlist.append(div);
				let p = $("<p>").text("nome: " + film.NomeFilm);
				div.append(p);
			}
		})
		watchlistRQ.catch(errore)
	}

	let divprogrammazione = $('#divprogrammazione');
	let btnModifiche = $("#modifiche");
	divprogrammazione.hide();
	btnModifiche.hide();

    /*$("#programmazione").on("click", function() {
		divprogrammazione.show();
		btnModifiche.show();
		getCinema();
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
		})
		filmRQ.catch(errore);
	});

	function getCinema() {
		let cinemaRQ = inviaRichiesta('GET', '/api/getcinema');
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
				divprogrammazione.append(div);
			}
		})
		cinemaRQ.catch(errore)
	}*/

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