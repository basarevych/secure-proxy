'use strict'

function submitPassword() {
    var gl = window['globalize'];
    var login = validateFormField($('#login')),
        password = validateFormField($('#password')),
        messages = $('#login-messages');

    messages.empty();

    if (!login) {
        $('#login').focus();
        return;
    }

    if (!password) {
        $('#password').focus();
        return;
    }

    $('#submit-password-button')
        .addClass('disabled')
        .prop('disabled', true)
        .html('<img src="/secure-proxy/static/auth/img/loader.gif">');
    $('#reset-password-button').hide();

    $.ajax({
        url: '/secure-proxy/api/auth',
        method: 'GET',
        data: {
            action: 'check',
            login: $('#login').val(),
            password: $('#password').val(),
        },
        success: function (data) {
            $('#submit-password-button')
                .removeClass('disabled')
                .prop('disabled', false)
                .text(gl.formatMessage('SUBMIT_LABEL'));
            $('#reset-password-button').show();

            if (data.reload) {
                $('#main-form').slideUp(function () { window.location.reload(); });
                return;
            }

            if (!data.success) {
                var msg = $('<div></div>');
                msg.addClass('alert alert-danger')
                   .text(gl.formatMessage('INVALID_LOGIN'))
                   .appendTo(messages);
                return;
            }

            $.ajax({
                url: '/secure-proxy/api/otp',
                method: 'GET',
                data: {
                    action: 'get'
                },
                success: function (data) {
                    if (data.reload) {
                        $('#main-form').slideUp(function () { window.location.reload(); });
                        return;
                    }

                    if (!data.success) {
                        alert(gl.formatMessage('INTERNAL_ERROR'));
                        return;
                    }

                    if (typeof data['qr_code'] == 'undefined') {
                        $('#qr-show-group').hide();
                        $('#reset-otp-button').show();
                    } else {
                        $('#qr-show-group').show();
                        $('#reset-otp-button').hide();
                        $('#qr-code').qrcode({
                            "width": 80,
                            "height": 80,
                            "text": data.qr_code,
                        });
                    }
                    $('#login')
                        .addClass('disabled')
                        .prop('disabled', true);
                    $('#password')
                        .addClass('disabled')
                        .prop('disabled', true);
                    $('#submit-password-button').hide();
                    $('#reset-password-button').hide();
                    $('#otp').val('');
                    $('#otp-section').slideDown(function () { $('#otp').focus() });
                },
                error: function () {
                    alert(gl.formatMessage('INTERNAL_ERROR'));
                },
            });
        },
        error: function () {
            $('#submit-password-button')
                .removeClass('disabled')
                .prop('disabled', false)
                .text(gl.formatMessage('SUBMIT_LABEL'));
            $('#reset-password-button').show();

            alert(gl.formatMessage('INTERNAL_ERROR'));
        },
    });
}

function resetPassword() {
    var gl = window['globalize'];
    var messages = $('#reset-messages');
    messages.empty();
    $('#email').val(''),
    $('#modal-form .form-group').removeClass('has-error');
    $('#modal-form .help-block ul').empty();

    $('#modal-submit')
        .off('click')
        .on('click', function () {
            messages.empty();

            var email = validateFormField($('#email'));

            if (!email) {
                $('#email').focus();
                return;
            }

            $('#modal-submit').addClass('disabled').prop('disabled', true);

            $.ajax({
                url: '/secure-proxy/api/reset-request',
                method: 'GET',
                data: {
                    type: 'password',
                    email: $('#email').val(),
                    lang: window['locale'],
                },
                success: function (data) {
                    if (data.success) {
                        var msg = $('<div></div>');
                        msg.addClass('alert alert-success')
                           .text(gl.formatMessage('EMAIL_SENT'))
                           .appendTo(messages);
                    } else {
                        var external = data.reason && data.reason == 'external-password';
                        var msg = $('<div></div>');
                        msg.addClass('alert alert-danger')
                           .text(gl.formatMessage(external ? 'EXTERN_PASSWORD' : 'INVALID_EMAIL'))
                           .appendTo(messages);
                        $('#modal-submit').removeClass('disabled').prop('disabled', false);
                    }
                },
                error: function () {
                    $('#modal-submit').removeClass('disabled').prop('disabled', false);

                    alert(gl.formatMessage('INTERNAL_ERROR'));
                },
            });
        });

    $('#modal-title').text(gl.formatMessage('RESET_PASSWORD_TITLE'));
    $('#modal-submit').removeClass('disabled').prop('disabled', false);
    $('#modal-form').modal('show');
    $('#email').focus();
}

function doResetPassword() {
    var gl = window['globalize'];
    var newpassword1 = validateFormField($('#newpassword1')),
        newpassword2 = validateFormField($('#newpassword2'));
    var parts = window.location.toString().split('#');
    var secret = parts.length >= 2 && parts[1];

    if (!newpassword1) {
        $('#newpassword1').focus();
        return;
    }

    if (!newpassword2) {
        $('#newpassword2').focus();
        return;
    }

    var messages = $('#password-messages');
    if ($('#newpassword1').val() != $('#newpassword2').val()) {
        var msg = $('<div></div>');
        msg.addClass('alert alert-danger')
           .text(gl.formatMessage('PASSWORDS_DO_NOT_MATCH'))
           .appendTo(messages);
        return;
    }

    $.ajax({
        url: '/secure-proxy/api/auth',
        method: 'GET',
        data: {
            action: 'set',
            secret: secret,
            password: $('#newpassword1').val(),
        },
        success: function (data) {
            messages.empty();

            if (data.success) {
                var msg = $('<div></div>');
                msg.addClass('alert alert-success')
                   .text(gl.formatMessage('PASSWORD_RESET_SUCCESS'))
                   .appendTo(messages);
                $('#password-section').hide();
            } else {
                var expired = data.reason && data.reason == 'expired';
                var msg = $('<div></div>');
                msg.addClass('alert alert-danger')
                   .text(gl.formatMessage(expired ? 'PAGE_EXPIRED' : 'PASSWORD_RESET_FAILURE'))
                   .appendTo(messages);
            }
        },
        error: function () {
            alert(gl.formatMessage('INTERNAL_ERROR'));
        },
    });
}
