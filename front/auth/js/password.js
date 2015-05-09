'use strict'

function submitPassword() {
    var login = validateFormField($('#login')),
        password = validateFormField($('#password'));

    if (!login) {
        $('#login').focus();
        return;
    }

    if (!password) {
        $('#password').focus();
        return;
    }

    $.ajax({
        url: '/secure-proxy/api/auth',
        method: 'GET',
        data: {
            action: 'check',
            login: $('#login').val(),
            password: $('#password').val(),
        },
        success: function (data) {
            var messages = $('#login-messages');
            messages.empty();

            if (data.success) {
                if (data.next == 'done') {
                    $('#main-form').slideUp(function () { window.location.reload(); });
                    return;
                } else if (data.next == 'otp') {
                    $.ajax({
                        url: '/secure-proxy/api/otp',
                        method: 'GET',
                        data: {
                            action: 'get'
                        },
                        success: function (data) {
                            if (!data.success && data.next == 'password') {
                                window.location.reload();
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
                        }
                    });
                }
            } else {
                var msg = $('<div></div>');
                msg.addClass('alert alert-danger')
                   .text(gl.formatMessage('INVALID_LOGIN'))
                   .appendTo(messages);
            }
        }
    });
}

function resetPassword() {
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
                    lang: currentLocale,
                },
                success: function (data) {
                    if (data.success) {
                        var msg = $('<div></div>');
                        msg.addClass('alert alert-success')
                           .text(gl.formatMessage('EMAIL_SENT'))
                           .appendTo(messages);
                    } else {
                        var extern = data.reason && data.reason == 'extern-password';
                        var msg = $('<div></div>');
                        msg.addClass('alert alert-danger')
                           .text(gl.formatMessage(extern ? 'EXTERN_PASSWORD' : 'INVALID_EMAIL'))
                           .appendTo(messages);
                        $('#modal-submit').removeClass('disabled').prop('disabled', false);
                    }
                },
            });
        });

    $('#modal-title').text(gl.formatMessage('RESET_PASSWORD_TITLE'));
    $('#modal-submit').removeClass('disabled').prop('disabled', false);
    $('#modal-form').modal('show');
    $('#email').focus();
}

function doResetPassword() {
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
        }
    });
}

function submitOtp() {
    var otp = validateFormField($('#otp'));

    if (!otp) {
        $('#otp').focus();
        return;
    }

    $.ajax({
        url: '/secure-proxy/api/otp',
        method: 'GET',
        data: {
            action: 'check',
            otp: $('#otp').val(),
        },
        success: function (data) {
            var messages = $('#otp-messages');
            messages.empty();

            if (data.success) {
                $('#main-form').slideUp(function () { window.location.reload(); });
                return;
            } else {
                if (data.next == 'password') {
                    window.location.reload();
                    return;
                }
                var msg = $('<div></div>');
                msg.addClass('alert alert-danger')
                   .text(gl.formatMessage('INVALID_OTP'))
                   .appendTo(messages);
            }
        }
    });
}

function resetOtp() {
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
                    type: 'otp',
                    email: $('#email').val(),
                    lang: currentLocale,
                },
                success: function (data) {
                    if (data.success) {
                        var msg = $('<div></div>');
                        msg.addClass('alert alert-success')
                           .text(gl.formatMessage('EMAIL_SENT'))
                           .appendTo(messages);
                    } else {
                        var msg = $('<div></div>');
                        msg.addClass('alert alert-danger')
                           .text(gl.formatMessage('INVALID_EMAIL'))
                           .appendTo(messages);
                        $('#modal-submit').removeClass('disabled').prop('disabled', false);
                    }
                },
            });
        });

    $('#modal-title').text(gl.formatMessage('RESET_OTP_TITLE'));
    $('#modal-submit').removeClass('disabled').prop('disabled', false);
    $('#modal-form').modal('show');
    $('#email').focus();
}

function doResetOtp() {
    var messages = $('#password-messages');
    var parts = window.location.toString().split('#');
    var secret = parts.length >= 2 && parts[1];

    $.ajax({
        url: '/secure-proxy/api/otp',
        method: 'GET',
        data: {
            action: 'reset',
            secret: secret,
        },
        success: function (data) {
            messages.empty();

            if (data.success) {
                var msg = $('<div></div>');
                msg.addClass('alert alert-success')
                   .text(gl.formatMessage('CODE_RESET_SUCCESS'))
                   .appendTo(messages);
                $('#password-section').hide();
            } else {
                var expired = data.reason && data.reason == 'expired';
                var msg = $('<div></div>');
                msg.addClass('alert alert-danger')
                   .text(gl.formatMessage(expired ? 'PAGE_EXPIRED' : 'CODE_RESET_FAILURE'))
                   .appendTo(messages);
            }
        }
    });
}
