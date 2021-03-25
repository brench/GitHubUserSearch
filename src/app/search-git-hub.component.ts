import { ThisReceiver } from '@angular/compiler';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { ApolloQueryResult } from '@apollo/client/core';
import { Apollo,gql } from 'apollo-angular';
import Observable from 'zen-observable';
import { GitHubUser } from './model/git-hub-user';

import { of } from "rxjs";
import {
  debounceTime,
  map,
  distinctUntilChanged,
  filter
} from "rxjs/operators";
import { fromEvent } from 'rxjs';

@Component({
  selector: 'app-search-git-hub',
  templateUrl: './search-git-hub.component.html',
})
export class SearchGitHubComponent implements OnInit {

  @ViewChild('searchInput', { static: true }) searchInput: ElementRef;
  searchCriteria: string = '';
  minCharsForSearch: number = 3;
  searchIsBeingDone: boolean = false;
  currentPage: number = 1;
  pageSize: number = 10;
  currentCursorVal: string = '';
  cursorValForPrevPage: string = '';
  cursorValForNextPage: string = '';
  totalItemCount: number = 0;
  totalPageCount: number = 1;
  users: GitHubUser[] = [];
  cachedUsers: GitHubUser[] = [];

  constructor(private apollo: Apollo) { }

  ngOnInit(): void {

    // https://www.freakyjolly.com/angular-rxjs-debounce-time-optimize-search-for-server-response/#.YF0YW69JHYw
    fromEvent(this.searchInput.nativeElement, 'keyup').pipe(

      // get value
      map((event: any) => {
        return event.target.value;
      })
      // if character length greater then 2
      , filter(res => res.length >= this.minCharsForSearch)

      // Time in milliseconds between key events
      , debounceTime(1000)

      // If previous query is different from current
      , distinctUntilChanged()

      // subscription for response
    ).subscribe((text: string) => {

      this.searchCriteria = text;

      this.doFreshSearch();

    });
  }



  doFreshSearch() {
    this.users = [];
    this.cachedUsers = [];
    this.currentPage = 1;
    this.currentCursorVal = '';

    if (this.searchCriteria.length < 2) return;

    this.doGitHubSearch();
  }

  // TODO: probably would want this in a separate service (with other GraphQL-related services)
  doGitHubSearch() {

    this.searchIsBeingDone = true;
    let afterVal = '';
    if (this.currentCursorVal != '') afterVal = ', after: "' + this.currentCursorVal + '"';

    this.apollo
    .watchQuery({
      query: gql`
        {
          search(query: "${this.searchCriteria} in:name,email ", type: USER, first: ${this.pageSize}${afterVal}) {
            userCount
            edges {
              cursor
              node {
                ... on User {
                  avatarUrl
                  url
                  login
                  name
                  location
                  email
                  company
                  repositories {
                    totalCount
                  }
                  issues {
                    totalCount
                  }
                  createdAt
                  updatedAt
                  id
                }
              }
            }
          }
        }
      `,
    })
    .valueChanges.subscribe((result: any) => {
      this.totalItemCount = result.data.search.userCount;
      this.totalPageCount = Math.ceil(this.totalItemCount / this.pageSize);
      // this.cursorValForPrevPage = this.cursorValForNextPage;
      // this.cursorValForNextPage = result.data.search.edges[result.data.search.edges.length - 1].cursor;
      this.currentCursorVal = result.data.search.edges[result.data.search.edges.length - 1].cursor;

      let returnedUsers: GitHubUser[] = result.data.search.edges.map((element: { node: { id: string; login: string; avatarUrl: string; location: string; name: string; email: string; repositories: { totalCount: number; }; createdAt: Date; updatedAt: Date; }; }) => {
        var user = new GitHubUser();
        user.ID = element.node.id;
        user.Username = element.node.login;
        user.AvatarUrl = element.node.avatarUrl;
        user.Location = element.node.location;
        user.Name = element.node.name;
        user.Email = element.node.email;
        user.CountOfPublicRepos = element.node.repositories.totalCount;
        user.CreatedAt = element.node.createdAt;
        user.UpdatedAt = element.node.updatedAt;

        return user;
      });

      if (this.users.length == 0) {
        this.cachedUsers = returnedUsers;
      } else {
        this.cachedUsers = [...this.cachedUsers, ...returnedUsers];
      }

      this.users = returnedUsers;
      this.searchIsBeingDone = false;
    });
  }

  goToNextPage() {
    this.currentPage++;
    if (this.currentPage * this.pageSize === this.cachedUsers.length + this.pageSize) {
      this.doGitHubSearch();
    } else {
      this.users = this.cachedUsers.slice(this.pageSize * (this.currentPage - 1), this.pageSize * this.currentPage);
    }
    // this.currentCursorVal = this.cursorValForNextPage;
    // this.doGitHubSearch();
  }

  goToPreviousPage() {
    let previousRecordSubsetStartIndex = this.pageSize * (this.currentPage - 2);
    this.users = this.cachedUsers.slice(previousRecordSubsetStartIndex, previousRecordSubsetStartIndex + this.pageSize);
    this.currentPage--;
    // this.currentCursorVal = this.cursorValForPrevPage;
    // this.doGitHubSearch();
  }
}
