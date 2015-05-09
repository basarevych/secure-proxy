'use strict'

describe("Validator", function() {
    beforeEach(function (done) {
        $.ajax({
            url: 'test/fixtures/validator.html',
            dataType: 'html',
            success: function (html) {
                var fixture = $('<div id="fixture"></div>');
                $('body').append(fixture.append(html));
                done();
            }
        });

        var globalize = {
            formatMessage: function (msg) { return msg; }
        };
        window['globalize'] = globalize;
        spyOn(globalize, 'formatMessage').and.callThrough();
    });

    afterEach(function () {
        $('#fixture').remove();
    });

    it("checks for empty value", function() {
        validateFormField($('#fixture input'));

        expect(globalize.formatMessage).toHaveBeenCalledWith('FIELD_EMPTY');

        expect($('#fixture .form-group')).toHaveClass('has-error');

        var errors = [];
        $('#fixture .help-block ul li').each(function (index, el) {
            errors.push($(el).text());
        });
        expect(errors.indexOf('FIELD_EMPTY')).not.toBe(-1);
    });

    it("clears previous errors", function () {
        var success = validateFormField($('#fixture input'));
        expect(success).toBeFalsy();

        $('#fixture input').val('foobar');
        success = validateFormField($('#fixture input'));
        expect(success).toBeTruthy();

        expect($('#fixture .form-group')).not.toHaveClass('has-error');
        expect($('#fixture .help-block ul')).toBeEmpty();
    });
});
