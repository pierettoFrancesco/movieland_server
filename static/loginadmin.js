"use strict"

$(document).ready(function () {
	let _username = $("#usr")
	let _password = $("#pwd")
	let _lblErrore = $("#lblErrore")

	_lblErrore.hide();


	$("#btnLogin").on("click", controllaLogin)

	// il submit deve partire anche senza click 
	// con il solo tasto INVIO
	$(document).on('keydown', function (event) {
		if (event.keyCode == 13)
			controllaLogin();
	});


	function controllaLogin() {
		_username.removeClass("is-invalid");
		_username.prev().removeClass("icona-rossa");
		_password.removeClass("is-invalid");
		_password.prev().removeClass("icona-rossa");

		_lblErrore.hide();

		if (_username.val() == "") {
			_username.addClass("is-invalid");
			_username.prev().addClass("icona-rossa");
		}
		else if (_password.val() == "") {
			_password.addClass("is-invalid");
			_password.prev().addClass("icona-rossa");
		}
		else {
			let request = inviaRichiesta('POST', '/api/loginadmin',
				{
					"username": _username.val(),
					"password": _password.val()
				}
			);
			request.catch(function (err) {
				if (err.response.status == 401) {
					_lblErrore.show();
					console.log(err.response.data);
				}
				else {
					errore(err);
				}
			});
			request.then((response) => {
				window.location.href = "indexadmin.html";
			})
		}
	}


	_lblErrore.children("button").on("click", function () {
		_lblErrore.hide();
	})

});