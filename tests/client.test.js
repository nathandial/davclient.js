
/* global dav */
describe("client", function() {

    var client;
    var fakeServer;
    var oldPromise;

    beforeEach(function() {
        client = new dav.Client({
            baseUrl: 'http://example.org/',
            userName: 'user',
            password: 'password'
        });

        client.xmlNamespaces['http://example.org/ns'] = 'e';

        oldPromise = window.Promise;
        window.Promise = sinon.stub();

        fakeServer = sinon.fakeServer.create();
    });

    afterEach(function() {
        client = null;
        fakeServer.restore();
        fakeServer = null;
        window.Promise = oldPromise;
    });

    describe('request', function() {
        it('sends the given request', function() {

            client.request(
                'PUT',
                '/rel/path',
                {
                    'CustomHeader': 'Value',
                    'CustomHeader2': 'Value2'
                },
                'body'
            );

            expect(fakeServer.requests.length).toEqual(1);
            var request = fakeServer.requests[0];

            expect(request.method).toEqual('PUT');
            expect(request.url).toEqual('http://example.org/rel/path');

            expect(request.requestHeaders).toEqual({
                CustomHeader: 'Value',
                CustomHeader2: 'Value2',
                'Content-Type': 'text/plain;charset=utf-8',
                Authorization: 'Basic dXNlcjpwYXNzd29yZA==',
            });

            expect(request.requestBody).toEqual('body');
        });

        it('processes response', function() {
            client.request(
                'GET',
                '/rel/path',
                {
                    'CustomHeader': 'Value',
                    'CustomHeader2': 'Value2'
                },
                'body'
            );

            expect(fakeServer.requests.length).toEqual(1);
            var request = fakeServer.requests[0];

            expect(window.Promise.calledOnce).toEqual(true);

            var promise = window.Promise.getCall(0).args[0];
            var fulfillStub = sinon.stub();
            var rejectStub = sinon.stub();
            promise(fulfillStub, rejectStub);

            expect(fulfillStub.notCalled).toEqual(true);
            expect(rejectStub.notCalled).toEqual(true);

            request.respond(
                200,
                { 'Content-Type': 'text/plain' },
                'responsebody'
            );

            expect(fulfillStub.calledOnce).toEqual(true);
            expect(fulfillStub.getCall(0).args[0].body).toEqual('responsebody');
            expect(fulfillStub.getCall(0).args[0].status).toEqual(200);
            expect(fulfillStub.getCall(0).args[0].xhr).toBeDefined();

            expect(rejectStub.notCalled).toEqual(true);
        });

        it('parses multistatus response by calling the function', function() {
            client.request(
                'PROPFIND',
                '/rel/path'
            );

			var parseMultiStatusStub = sinon.stub(dav.Client.prototype, 'parseMultiStatus');

            expect(fakeServer.requests.length).toEqual(1);
            var request = fakeServer.requests[0];

            expect(window.Promise.calledOnce).toEqual(true);

            var promise = window.Promise.getCall(0).args[0];
            var fulfillStub = sinon.stub();
            var rejectStub = sinon.stub();
            promise(fulfillStub, rejectStub);

            expect(fulfillStub.notCalled).toEqual(true);
            expect(rejectStub.notCalled).toEqual(true);

			parseMultiStatusStub.returns(['dummy parsed']);

            request.respond(
                207,
                { 'Content-Type': 'application/xml' },
				'<?xml version="1.0" encoding="utf-8"?>' +
				'<dummy>dummy parsed</dummy>'
            );

			expect(parseMultiStatusStub.calledOnce).toEqual(true);

            expect(fulfillStub.calledOnce).toEqual(true);
            expect(fulfillStub.getCall(0).args[0].body).toEqual(['dummy parsed']);
            expect(fulfillStub.getCall(0).args[0].status).toEqual(207);
            expect(fulfillStub.getCall(0).args[0].xhr).toBeDefined();

            expect(rejectStub.notCalled).toEqual(true);

			parseMultiStatusStub.restore();
        });
    });

	describe('parseMultiStatus', function() {

		function makePropBlock(props) {
			var s = '<d:prop>\n';

			for (var key in props) {
				var value = props[key];
				s += '<' + key + '>' + value + '</' + key + '>\n';
			}

			return s + '</d:prop>\n';
		}

		function makeResponseBlock(href, props, failedProps) {
			var s = '<d:response>\n';
			s += '<d:href>' + href + '</d:href>\n';
			s += '<d:propstat>\n';
			s += makePropBlock(props);
			s += '<d:status>HTTP/1.1 200 OK</d:status>';
			s += '</d:propstat>\n';
			if (failedProps) {
				s += '<d:propstat>\n';
				s += '<d:prop>\n';
				for (var i = 0; i < failedProps.length; i++) {
					s += '<' + failedProps[i] + '/>\n';
				};
				s += '</d:prop>\n';
				s += '<d:status>HTTP/1.1 404 Not Found</d:status>\n';
				s += '</d:propstat>\n';
			}
			return s + '</d:response>\n';
		}

		var xml =
			'<?xml version="1.0" encoding="utf-8"?>' +
			'<d:multistatus xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns" xmlns:e="http://example.org/ns">' +
			makeResponseBlock(
				'/path/to%20space/%E6%96%87%E4%BB%B6%E5%A4%B9/', {
					'd:getlastmodified': 'Fri, 24 Jul 2016 21:00:05 GMT',
					'd:getetag': '"56cfcabd79abb"',
					'd:resourcetype': '<d:collection/>',
					'e:someprop': 'somevalue'
				}, [
					'd:getcontenttype',
					'd:getcontentlength'
				]
			) +
			makeResponseBlock(
			'/path/to%20space/%E6%96%87%E4%BB%B6%E5%A4%B9/One.txt', {
				'd:getlastmodified': 'Fri, 24 Jul 2016 21:38:05 GMT',
				'd:getetag': '"559fcabd79a38"',
				'd:getcontenttype': 'text/plain',
				'd:getcontentlength': 250,
				'd:resourcetype': ''
			}, [
				'e:someprop',
			]) +
			makeResponseBlock(
			'/path/to%20space/%E6%96%87%E4%BB%B6%E5%A4%B9/sub', {
				'd:getlastmodified': 'Fri, 24 Jul 2016 21:40:50 GMT',
				'd:getetag': '"66cfcabd79abb"',
				'd:resourcetype': '<d:collection/>',
				'e:someprop': 'anothervalue'
			}, [
				'd:getcontenttype',
				'd:getcontentlength'
			]) +
			'</d:multistatus>';

		it('parses XML to arrays', function() {
			var results = client.parseMultiStatus(xml);

			expect(results.length).toEqual(3);

			var result1 = results[0];
			expect(result1.href).toEqual('/path/to%20space/%E6%96%87%E4%BB%B6%E5%A4%B9/');
			expect(result1.propStat.length).toEqual(2);

			expect(result1.propStat[0].status).toEqual('HTTP/1.1 200 OK');
			var props = result1.propStat[0].properties;
			expect(props['{DAV:}getlastmodified']).toEqual('Fri, 24 Jul 2016 21:00:05 GMT');
			expect(props['{DAV:}getetag']).toEqual('"56cfcabd79abb"');
			expect(props['{http://example.org/ns}someprop']).toEqual('somevalue');
			var resourceType = props['{DAV:}resourcetype'];
			expect(resourceType[0].namespaceURI).toEqual('DAV:');
			expect(resourceType[0].nodeName).toEqual('d:collection');

			expect(result1.propStat[1].status).toEqual('HTTP/1.1 404 Not Found');
			expect(result1.propStat[1].properties).toEqual({
				'{DAV:}getcontenttype': '',
				'{DAV:}getcontentlength': ''
			});

			var result2 = results[1];
			expect(result2.href).toEqual('/path/to%20space/%E6%96%87%E4%BB%B6%E5%A4%B9/One.txt');
			expect(result2.propStat.length).toEqual(2);

			expect(result2.propStat[0].status).toEqual('HTTP/1.1 200 OK');
			var props = result2.propStat[0].properties;
			expect(props['{DAV:}getlastmodified']).toEqual('Fri, 24 Jul 2016 21:38:05 GMT');
			expect(props['{DAV:}resourcetype']).toEqual('');

			var result3 = results[2];
			expect(result3.href).toEqual('/path/to%20space/%E6%96%87%E4%BB%B6%E5%A4%B9/sub');
			expect(result3.propStat.length).toEqual(2);

			expect(result3.propStat[0].status).toEqual('HTTP/1.1 200 OK');
			var props = result3.propStat[0].properties;
			expect(props['{DAV:}getlastmodified']).toEqual('Fri, 24 Jul 2016 21:40:50 GMT');

		});
	});

});
