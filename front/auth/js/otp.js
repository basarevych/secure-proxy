'use strict'

function submitOtp() {
    var gl = window['globalize'];
    var otp = validateFormField($('#otp'));

    if (!otp) {
        $('#otp').focus();
        return;
    }

    $('#submit-otp-button')
        .addClass('disabled')
        .prop('disabled', true)
        .html('<img src="/secure-proxy/static/auth/img/loader.gif">');
    $('#reset-otp-button').hide();

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

            $('#submit-otp-button')
                .removeClass('disabled')
                .prop('disabled', false)
                .text(gl.formatMessage('SUBMIT_LABEL'));
            $('#reset-otp-button').show();

            if (data.reload) {
                $('#main-form').slideUp(function () { window.location.reload(); });
                return;
            }

            if (!data.success) {
                var msg = $('<div></div>');
                msg.addClass('alert alert-danger')
                   .text(gl.formatMessage('INVALID_OTP'))
                   .appendTo(messages);
            }
        },
        error: function () {
            $('#submit-otp-button')
                .removeClass('disabled')
                .prop('disabled', false)
                .text(gl.formatMessage('SUBMIT_LABEL'));
            $('#reset-otp-button').show();

            alert(gl.formatMessage('INTERNAL_ERROR'));
        },
    });
}

function resetOtp() {
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
                    type: 'otp',
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
                        var msg = $('<div></div>');
                        msg.addClass('alert alert-danger')
                           .text(gl.formatMessage('INVALID_EMAIL'))
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

    $('#modal-title').text(gl.formatMessage('RESET_OTP_TITLE'));
    $('#modal-submit').removeClass('disabled').prop('disabled', false);
    $('#modal-form').modal('show');
    $('#email').focus();
}

function doResetOtp() {
    var gl = window['globalize'];
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
        },
        error: function () {
            alert(gl.formatMessage('INTERNAL_ERROR'));
        },
    });
}
