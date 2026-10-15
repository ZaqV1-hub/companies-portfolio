-- Synthetic CRM records for the test environment. The demo-crm- prefix is shown in the UI.
-- INSERT IGNORE makes the data safe to retain when this migration is retried after a partial run.
INSERT IGNORE INTO institutions (id,name,investor_type,created_at) VALUES
('demo-crm-inst-01','Atlas Capital (DEMO)','vc',UTC_TIMESTAMP()),
('demo-crm-inst-02','Orion Health Ventures (DEMO)','cvc',UTC_TIMESTAMP()),
('demo-crm-inst-03','Cedar Family Office (DEMO)','family_office',UTC_TIMESTAMP()),
('demo-crm-inst-04','Northbridge Partners (DEMO)','pe_firm',UTC_TIMESTAMP()),
('demo-crm-inst-05','Global Health Alliance (DEMO)','organization',UTC_TIMESTAMP());

INSERT IGNORE INTO contacts (id,institution_id,name,email,country,city,role,created_at) VALUES
('demo-crm-contact-01','demo-crm-inst-01','Alex Morgan (DEMO)','alex.morgan.demo01@example.com','US','Boston','Partner',UTC_TIMESTAMP()),
('demo-crm-contact-02','demo-crm-inst-02','Camila Reed (DEMO)','camila.reed.demo02@example.com','US','New York','Director',UTC_TIMESTAMP()),
('demo-crm-contact-03','demo-crm-inst-03','Daniel Costa (DEMO)','daniel.costa.demo03@example.com','BR','São Paulo','Investment Lead',UTC_TIMESTAMP()),
('demo-crm-contact-04','demo-crm-inst-04','Eva Fischer (DEMO)','eva.fischer.demo04@example.com','DE','Berlin','Principal',UTC_TIMESTAMP()),
('demo-crm-contact-05','demo-crm-inst-05','Fatima Ali (DEMO)','fatima.ali.demo05@example.com','GB','London','Program Manager',UTC_TIMESTAMP()),
('demo-crm-contact-06','demo-crm-inst-01','George Walker (DEMO)','george.walker.demo06@example.com','US','Chicago','Analyst',UTC_TIMESTAMP()),
('demo-crm-contact-07','demo-crm-inst-02','Helena Souza (DEMO)','helena.souza.demo07@example.com','BR','Campinas','Investment Manager',UTC_TIMESTAMP()),
('demo-crm-contact-08','demo-crm-inst-03','Ivan Lopez (DEMO)','ivan.lopez.demo08@example.com','ES','Madrid','Partner',UTC_TIMESTAMP()),
('demo-crm-contact-09','demo-crm-inst-04','Julia Martin (DEMO)','julia.martin.demo09@example.com','FR','Paris','Director',UTC_TIMESTAMP()),
('demo-crm-contact-10','demo-crm-inst-05','Kenji Tanaka (DEMO)','kenji.tanaka.demo10@example.com','JP','Tokyo','Coordinator',UTC_TIMESTAMP()),
('demo-crm-contact-11','demo-crm-inst-01','Laura Kim (DEMO)','laura.kim.demo11@example.com','KR','Seoul','Partner',UTC_TIMESTAMP()),
('demo-crm-contact-12','demo-crm-inst-02','Mateo Rossi (DEMO)','mateo.rossi.demo12@example.com','IT','Milan','Manager',UTC_TIMESTAMP()),
('demo-crm-contact-13','demo-crm-inst-03','Nina Patel (DEMO)','nina.patel.demo13@example.com','US','San Francisco','Investor',UTC_TIMESTAMP()),
('demo-crm-contact-14','demo-crm-inst-04','Omar Haddad (DEMO)','omar.haddad.demo14@example.com','AE','Dubai','Principal',UTC_TIMESTAMP()),
('demo-crm-contact-15','demo-crm-inst-05','Paula Mendes (DEMO)','paula.mendes.demo15@example.com','BR','Rio de Janeiro','Advisor',UTC_TIMESTAMP());

INSERT IGNORE INTO relationships (id,contact_id,organization_id,origin,status,classification,classification_state,created_at) VALUES
('demo-crm-rel-01','demo-crm-contact-01','imunotera','Contato direto','in_progress','lead','validated',UTC_TIMESTAMP()),
('demo-crm-rel-02','demo-crm-contact-02','imunotera','Portfólio','in_progress','nia','validated',UTC_TIMESTAMP() - INTERVAL 1 DAY),
('demo-crm-rel-03','demo-crm-contact-03','imunotera','Indicação de investidor','deal','npia','validated',UTC_TIMESTAMP() - INTERVAL 2 DAY),
('demo-crm-rel-04','demo-crm-contact-04','program','Contato direto','in_progress','lead','validated',UTC_TIMESTAMP() - INTERVAL 3 DAY),
('demo-crm-rel-05','demo-crm-contact-05','nintx','BIO Convention','in_progress','nia','validated',UTC_TIMESTAMP() - INTERVAL 4 DAY),
('demo-crm-rel-06','demo-crm-contact-06','huna','Cold call','closed','br','validated',UTC_TIMESTAMP() - INTERVAL 6 DAY),
('demo-crm-rel-07','demo-crm-contact-07','aurora','Portfólio','in_progress','lead','validated',UTC_TIMESTAMP() - INTERVAL 8 DAY),
('demo-crm-rel-08','demo-crm-contact-08','techtrials','Contato direto','in_progress','nia','validated',UTC_TIMESTAMP() - INTERVAL 10 DAY),
('demo-crm-rel-09','demo-crm-contact-09','croplabs','Indicação de investidor','deal','npia','validated',UTC_TIMESTAMP() - INTERVAL 14 DAY),
('demo-crm-rel-10','demo-crm-contact-10','biofactor','BIO Convention','in_progress','lead','validated',UTC_TIMESTAMP() - INTERVAL 18 DAY),
('demo-crm-rel-11','demo-crm-contact-11','program','Contato direto','closed','br','validated',UTC_TIMESTAMP() - INTERVAL 24 DAY),
('demo-crm-rel-12','demo-crm-contact-12','imunotera','Cold call','in_progress','incomplete','validated',UTC_TIMESTAMP() - INTERVAL 32 DAY),
('demo-crm-rel-13','demo-crm-contact-13','nintx','Portfólio','in_progress','lead','validated',UTC_TIMESTAMP() - INTERVAL 43 DAY),
('demo-crm-rel-14','demo-crm-contact-14','huna','Contato direto','in_progress','nia','validated',UTC_TIMESTAMP() - INTERVAL 58 DAY),
('demo-crm-rel-15','demo-crm-contact-15','aurora','Indicação de investidor','deal','npia','validated',UTC_TIMESTAMP() - INTERVAL 77 DAY);

INSERT IGNORE INTO interactions (id,relationship_id,date,description,type,auto,created_at) VALUES
('demo-crm-it-01','demo-crm-rel-01',UTC_DATE(),'Contato de demonstração recebido por conversa direta.','email',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-02','demo-crm-rel-02',UTC_DATE() - INTERVAL 1 DAY,'Reunião virtual de demonstração.','virtual_meeting',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-03','demo-crm-rel-03',UTC_DATE() - INTERVAL 2 DAY,'Proposta de demonstração apresentada.','proposal_term_sheet',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-04','demo-crm-rel-04',UTC_DATE() - INTERVAL 3 DAY,'Contato externo de demonstração.','in_person_meeting',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-05','demo-crm-rel-05',UTC_DATE() - INTERVAL 4 DAY,'Apresentação no evento de demonstração.','in_person_meeting',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-06','demo-crm-rel-06',UTC_DATE() - INTERVAL 6 DAY,'Troca de e-mails de demonstração.','email',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-07','demo-crm-rel-07',UTC_DATE() - INTERVAL 8 DAY,'Envio de material de demonstração.','material_sent',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-08','demo-crm-rel-08',UTC_DATE() - INTERVAL 10 DAY,'Reunião virtual de demonstração.','virtual_meeting',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-09','demo-crm-rel-09',UTC_DATE() - INTERVAL 14 DAY,'Assinatura de NDA de demonstração.','nda',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-10','demo-crm-rel-10',UTC_DATE() - INTERVAL 18 DAY,'Contato em evento de demonstração.','in_person_meeting',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-11','demo-crm-rel-11',UTC_DATE() - INTERVAL 24 DAY,'Contato encerrado para demonstração.','email',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-12','demo-crm-rel-12',UTC_DATE() - INTERVAL 32 DAY,'Primeiro contato de demonstração.','other',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-13','demo-crm-rel-13',UTC_DATE() - INTERVAL 43 DAY,'Pedido pelo portfólio de demonstração.','email',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-14','demo-crm-rel-14',UTC_DATE() - INTERVAL 58 DAY,'Reunião de demonstração.','virtual_meeting',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-15','demo-crm-rel-15',UTC_DATE() - INTERVAL 77 DAY,'Proposta de demonstração.','proposal_term_sheet',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-16','demo-crm-rel-01',UTC_DATE(),'Reunião de acompanhamento de demonstração.','virtual_meeting',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-17','demo-crm-rel-02',UTC_DATE(),'Material enviado para demonstração.','material_sent',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-18','demo-crm-rel-03',UTC_DATE() - INTERVAL 1 DAY,'Assinatura de NDA de demonstração.','nda',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-19','demo-crm-rel-05',UTC_DATE() - INTERVAL 2 DAY,'Reunião de acompanhamento de demonstração.','virtual_meeting',FALSE,UTC_TIMESTAMP()),
('demo-crm-it-20','demo-crm-rel-07',UTC_DATE() - INTERVAL 3 DAY,'Proposta de demonstração enviada.','proposal_term_sheet',FALSE,UTC_TIMESTAMP());
