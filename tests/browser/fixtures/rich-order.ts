export const RICH_ORDER_CONTENT_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="order-rich-content" title="Rich order content" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>
  <qti-item-body>
    <qti-order-interaction response-identifier="RESPONSE" orientation="vertical">
      <qti-prompt>Put these in order.</qti-prompt>
      <qti-simple-choice identifier="BenNevis">
        <div class="c1">
          <div class="c1p1">
            <div class="c2">Ben Nevis</div>
            <div class="c3"><strong>User:</strong> <a href="https://example.test/people/euphbass">euphbass</a><br/><strong>Tags:</strong> snow, skiing</div>
          </div>
          <div class="c4">
            <div class="c4p1"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Crect width='10' height='10' fill='green'/%3E%3C/svg%3E" alt="Ben Nevis"/></div>
            <div class="c5"><a class="c5a" href="https://example.test/photos/ben-nevis">View Photo</a></div>
          </div>
          <div id="myFlickr4414106953">
            <!-- <div class="hidden-photo">Hidden Flickr markup</div> -->
          </div>
        </div>
      </qti-simple-choice>
      <qti-simple-choice identifier="BenMacdui"><div class="c1"><div class="c2">Ben Macdui</div></div></qti-simple-choice>
    </qti-order-interaction>
  </qti-item-body>
</qti-assessment-item>`;
