'use strict'

describe("Password functions", function () {
    beforeEach(function (done) {
        $.ajax({
            url: 'html/index.html',
            dataType: 'html',
            success: function (html) {
                var fixture = $('<div id="fixture"></div>');
                $('body').append(fixture.append(html));
                done();
            }
        });

        var gl = {
            formatMessage: function (msg) { return msg; }
        };
        window['globalize'] = gl;
        spyOn(gl, 'formatMessage').and.callThrough();
    });

    afterEach(function () {
        $('#fixture').remove();
    });

    it("check and focus empty fields", function () {
        submitPassword();
        expect($('#login')).toBeFocused();

        $('#login').val('foobar');
        submitPassword();
        expect($('#password')).toBeFocused();
    });

    it("handle invalid credentials", function () {
        spyOn($, 'ajax').and.callFake(function (params) {
            params.success({ success: false });
        });

        $('#login').val('foo');
        $('#password').val('bar');
        submitPassword();

        expect($.ajax).toHaveBeenCalled();
        expect($('#login-messages')).toContainHtml('INVALID_LOGIN');
    });
});
