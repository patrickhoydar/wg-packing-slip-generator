# InquirED Packing Slip Logic

### Shipping Services 
ColB (Dock?) and ColC (Paved Path?) decision logic. These two columns impact the shipping services to be used for a shipment. 
```mermaid
---
config:
  theme: redux
---
flowchart TD
    A(["XLSX Order File"]) --> B{"ColB [Dock?]"}
    B --> C["Yes"] & D["No"]
    C --> n1["Standard LTL Shipment"]
    D --> n2["ColC [Paved Path?]"]
    n2 --> n3["Yes"] & n5["No"]
    n3 --> n4["LTL Shipment with lift gate &amp; inside delivery"]
    n5 --> n6["LTL Shipment with white glove service"]
```
- If the shipment contains < 10 boxes then ship via UPS (This logic is still TBD since the size of individual pieces determines how many items can be packed in a box for TE orders)
- Set the shipment day for 2 days before the Ship Date (ColAD) to ensure shipments don't arrive too early
  - When a shipment doesn't have an Ship Date then assume it should have the same Ship Date as the shipment with the soonesnt Ship Date


### Additional Data Needed on the Slip
- Add ColD (Receiving Days) and ColE (Receiving Hours)
- Add ColJ (Delivery Notes) to special notes section
- Add Col['Appointment Required?'] value

